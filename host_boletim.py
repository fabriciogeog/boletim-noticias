"""
host_boletim.py — Host MCP do Boletim de Notícias com Ollama local

Conecta o Ollama (LLM local) ao servidor MCP do Boletim,
permitindo ao locutor interagir com o sistema via linguagem natural.

Pré-requisitos:
  - Docker rodando (docker compose up -d)
  - Ollama rodando com qwen2.5:7b
  - .env configurado com OLLAMA_URL, OLLAMA_MODELO, etc.

Uso:
  uv run python host_boletim.py
"""

import asyncio
import json
import logging
import os
import sys
from datetime import datetime
from pathlib import Path

import requests
from dotenv import load_dotenv
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

# ================================================
# CONFIGURAÇÃO
# ================================================

load_dotenv()

OLLAMA_URL      = os.getenv("OLLAMA_URL",    "http://localhost:11434/api/chat")
MODELO          = os.getenv("OLLAMA_MODELO", "qwen2.5:7b")
BOLETIM_API_URL = os.getenv("BOLETIM_API_URL", "http://localhost:8000")
USUARIO_ATUAL   = os.getenv("MCP_USUARIO",   "locutor")
LOG_FILE        = os.getenv("MCP_LOG_FILE",  "audit_locutor.log")

# Caminhos do servidor MCP do Boletim
_BASE = Path(__file__).parent
SERVIDOR_PYTHON = str(_BASE / ".venv" / "bin" / "python")
SERVIDOR_SCRIPT = str(_BASE / "servidor_mcp.py")

# Validação rápida na inicialização
erros = []
if not Path(SERVIDOR_PYTHON).exists():
    erros.append(f"Python do venv não encontrado: {SERVIDOR_PYTHON}")
if not Path(SERVIDOR_SCRIPT).exists():
    erros.append(f"servidor_mcp.py não encontrado: {SERVIDOR_SCRIPT}")
if erros:
    for e in erros:
        print(f"[ERRO] {e}", file=sys.stderr)
    sys.exit(1)


# ================================================
# LOGGING DE AUDITORIA
# ================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
    ]
)
logger = logging.getLogger("boletim.audit")


def registrar(evento: str, detalhe: str = ""):
    logger.info(json.dumps({
        "timestamp": datetime.now().isoformat(),
        "usuario":   USUARIO_ATUAL,
        "evento":    evento,
        "detalhe":   detalhe[:300]
    }, ensure_ascii=False))


def registrar_tool(tool: str, args: dict, resultado: str, erro: bool = False):
    entrada = {
        "timestamp": datetime.now().isoformat(),
        "usuario":   USUARIO_ATUAL,
        "tool":      tool,
        "args":      args,
        "sucesso":   not erro,
        "resultado": resultado[:300]
    }
    if erro:
        logger.error(json.dumps(entrada, ensure_ascii=False))
    else:
        logger.info(json.dumps(entrada, ensure_ascii=False))


# ================================================
# VERIFICAÇÕES PRÉ-SESSÃO
# ================================================

def verificar_ollama() -> bool:
    """Verifica se o Ollama está acessível."""
    try:
        r = requests.get("http://localhost:11434/api/tags", timeout=5)
        return r.status_code == 200
    except Exception:
        return False


def verificar_docker() -> bool:
    """Verifica se o backend do Boletim está respondendo."""
    try:
        r = requests.get(f"{BOLETIM_API_URL}/health", timeout=5)
        return r.status_code == 200
    except Exception:
        return False


# ================================================
# VALIDAÇÃO DE ARGUMENTOS DAS TOOLS
# ================================================

REGRAS_TOOLS = {
    "gerar_boletim": {
        "num_artigos": {"tipo": int, "min": 1, "max": 20},
        "motor_tts":   {"tipo": str, "valores_permitidos": ["gtts", "elevenlabs"]},
        "modo_resumo": {"tipo": str, "valores_permitidos": ["none", "groq"]},
        "estilo":      {"tipo": str, "valores_permitidos": [
            "jornalistico", "descontraido", "urgente"
        ]}
    },
    "deletar_boletim": {
        "id": {"tipo": int, "min": 1}
    },
    "confirmar_audio": {
        "filename": {"tipo": str, "obrigatorio": True}
    },
    "regenerar_audio": {
        "texto": {"tipo": str, "obrigatorio": True, "max_len": 5000}
    }
}


def validar_args(tool: str, args: dict) -> tuple[bool, str]:
    regras = REGRAS_TOOLS.get(tool)
    if not regras:
        return True, ""

    for campo, regra in regras.items():
        valor = args.get(campo)

        if regra.get("obrigatorio") and (valor is None or valor == ""):
            return False, f"Campo obrigatório ausente: '{campo}'"

        if valor is None:
            continue

        tipo = regra.get("tipo")
        if tipo and not isinstance(valor, tipo):
            return False, f"'{campo}' deve ser {tipo.__name__}"

        if isinstance(valor, int):
            if "min" in regra and valor < regra["min"]:
                return False, f"'{campo}' deve ser >= {regra['min']}"
            if "max" in regra and valor > regra["max"]:
                return False, f"'{campo}' deve ser <= {regra['max']}"

        if isinstance(valor, str):
            if "max_len" in regra and len(valor) > regra["max_len"]:
                return False, f"'{campo}' excede {regra['max_len']} caracteres"
            if "valores_permitidos" in regra and valor not in regra["valores_permitidos"]:
                return False, f"'{campo}' deve ser um de {regra['valores_permitidos']}"

    return True, ""


# ================================================
# CONVERSÃO TOOLS MCP → FORMATO OLLAMA
# ================================================

def mcp_tool_para_ollama(tool) -> dict:
    return {
        "type": "function",
        "function": {
            "name":        tool.name,
            "description": tool.description or "",
            "parameters":  tool.inputSchema or {
                "type": "object", "properties": {}
            }
        }
    }


# ================================================
# SISTEMA DE CONTEXTO — orienta o Ollama
# ================================================

SYSTEM_PROMPT = """Você é um assistente do sistema de Boletim de Notícias ON AIR.
IMPORTANTE: Responda SEMPRE em português do Brasil, sem exceção.

Seu usuário é um locutor de rádio com deficiência visual.
Seja direto e objetivo. Não analise nem classifique dados — apenas apresente.

Quando listar boletins, use este formato simples:
- ID [número] | [data] | [categoria] | áudio: [arquivo]

Ferramentas disponíveis:
- verificar_api: verifica se o sistema está online
- gerar_boletim: gera boletim com áudio (sempre confirme o áudio depois)
- confirmar_audio: confirma que o áudio foi gerado
- listar_historico: lista boletins já gerados
- deletar_boletim: remove um boletim pelo id
- regenerar_audio: converte texto em fala

Categorias: geral, esportes, tecnologia, politica, economia, saude, ciencia, mundo.

Regras:
1. Sempre responda em português do Brasil.
2. Ao listar boletins, mostre apenas id, data, categoria e arquivo — sem análise.
3. Ao gerar boletim, sempre chame confirmar_audio em seguida.
4. Respostas curtas e diretas."""


# ================================================
# CICLO DE CONVERSA
# ================================================

async def conversar(session: ClientSession, tools_ollama: list, pergunta: str) -> str:
    historico = [
        {"role": "system",  "content": SYSTEM_PROMPT},
        {"role": "user",    "content": pergunta}
    ]

    while True:
        try:
            resposta = requests.post(OLLAMA_URL, json={
                "model":    MODELO,
                "messages": historico,
                "tools":    tools_ollama,
                "stream":   False
            }, timeout=120).json()
        except requests.exceptions.Timeout:
            msg = "O modelo demorou demais para responder. Tente novamente."
            registrar("timeout_ollama")
            return msg
        except Exception as e:
            registrar("erro_ollama", str(e))
            return f"Erro de comunicação com o modelo: {e}"

        msg = resposta["message"]
        historico.append(msg)

        if msg.get("tool_calls"):
            for tc in msg["tool_calls"]:
                nome = tc["function"]["name"]
                args = tc["function"]["arguments"]

                # Validação
                valido, motivo = validar_args(nome, args)
                if not valido:
                    conteudo = f"Erro de validação: {motivo}"
                    registrar_tool(nome, args, conteudo, erro=True)
                    historico.append({"role": "tool", "content": conteudo})
                    continue

                # Execução
                try:
                    resultado  = await session.call_tool(nome, args)
                    conteudo   = resultado.content[0].text if resultado.content else "sem resultado"
                    registrar_tool(nome, args, conteudo)
                except Exception as e:
                    conteudo = f"Erro ao executar '{nome}': {e}"
                    registrar_tool(nome, args, conteudo, erro=True)

                historico.append({"role": "tool", "content": conteudo})

        else:
            resposta_final = msg["content"]
            registrar("resposta_final", resposta_final[:200])
            return resposta_final


# ================================================
# MAIN — interface interativa
# ================================================

async def main():
    # Verificações antes de iniciar
    print("\nVerificando pré-requisitos...")

    if not verificar_ollama():
        print("[ERRO] Ollama não está acessível. Verifique se está rodando.")
        sys.exit(1)
    print(f"  ✓ Ollama online ({MODELO})")

    if not verificar_docker():
        print(f"[ERRO] Backend do Boletim não responde em {BOLETIM_API_URL}.")
        print("       Execute: docker compose up -d")
        sys.exit(1)
    print(f"  ✓ Backend online ({BOLETIM_API_URL})")

    registrar("inicio_sessao", f"modelo={MODELO}")

    print("\n" + "=" * 52)
    print("  BOLETIM ON AIR — Assistente com IA local")
    print(f"  Usuário : {USUARIO_ATUAL}")
    print(f"  Modelo  : {MODELO}")
    print("=" * 52)
    print("  Digite sua solicitação em linguagem natural.")
    print("  Comandos especiais:")
    print("    tools  — lista as ferramentas disponíveis")
    print("    log    — últimas 5 entradas do log de auditoria")
    print("    sair   — encerra a sessão")
    print("=" * 52 + "\n")

    params = StdioServerParameters(
        command=SERVIDOR_PYTHON,
        args=[SERVIDOR_SCRIPT]
    )

    try:
        async with stdio_client(params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()

                tools_mcp    = await session.list_tools()
                tools_ollama = [mcp_tool_para_ollama(t) for t in tools_mcp.tools]
                nomes_tools  = [t.name for t in tools_mcp.tools]

                registrar("tools_descobertas", str(nomes_tools))
                print(f"[Sistema] {len(nomes_tools)} ferramentas carregadas.\n")

                while True:
                    try:
                        pergunta = input("Você: ").strip()
                    except (EOFError, KeyboardInterrupt):
                        print()
                        break

                    if not pergunta:
                        continue

                    if pergunta.lower() in ("sair", "exit", "quit"):
                        break

                    if pergunta.lower() == "tools":
                        print(f"[Sistema] Ferramentas: {nomes_tools}\n")
                        continue

                    if pergunta.lower() == "log":
                        try:
                            linhas = Path(LOG_FILE).read_text(encoding="utf-8").splitlines()
                            print("[Sistema] Últimas 5 entradas do log:")
                            for linha in linhas[-5:]:
                                print(f"  {linha}")
                            print()
                        except FileNotFoundError:
                            print("[Sistema] Nenhum log encontrado ainda.\n")
                        continue

                    registrar("pergunta_usuario", pergunta[:200])
                    print("─" * 52)
                    resposta = await conversar(session, tools_ollama, pergunta)
                    print(f"\n{resposta}\n")
                    print("─" * 52)

    except Exception as e:
        registrar("erro_sessao", str(e))
        raise

    finally:
        registrar("fim_sessao")
        print(f"\n[Sistema] Sessão encerrada. Log em: {LOG_FILE}\n")


if __name__ == "__main__":
    asyncio.run(main())
