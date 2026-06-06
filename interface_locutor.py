"""
interface_locutor.py — Interface web acessível para o locutor cego

Serve uma página HTML minimalista com campo de conversa.
O Orca, NVDA e TalkBack leem páginas web muito melhor que terminais.

Uso:
  uv run python interface_locutor.py
  Acesse: http://localhost:5000  (ou http://IP-DA-MAQUINA:5000 na rede local)
"""

import asyncio
import json
from contextlib import asynccontextmanager
import logging
import os
import sys
from datetime import datetime
from pathlib import Path

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import uvicorn
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
PORTA_WEB       = int(os.getenv("PORTA_WEB", "5000"))

_BASE           = Path(__file__).parent
SERVIDOR_PYTHON = str(_BASE / ".venv" / "bin" / "python")
SERVIDOR_SCRIPT = str(_BASE / "servidor_mcp.py")

# ================================================
# LOGGING
# ================================================

logging.basicConfig(
    level=logging.INFO,
    handlers=[logging.FileHandler(LOG_FILE, encoding="utf-8")]
)
logger = logging.getLogger("boletim.web")

def registrar(evento: str, detalhe: str = ""):
    logger.info(json.dumps({
        "timestamp": datetime.now().isoformat(),
        "usuario": USUARIO_ATUAL,
        "evento": evento,
        "detalhe": detalhe[:300]
    }, ensure_ascii=False))

# ================================================
# SYSTEM PROMPT
# ================================================

SYSTEM_PROMPT = """Você é um assistente do sistema de Boletim de Notícias ON AIR.
IMPORTANTE: Responda SEMPRE em português do Brasil, sem exceção.

Seu usuário é um locutor de rádio com deficiência visual.
Seja direto e objetivo. Não analise nem classifique dados — apenas apresente.

Quando listar boletins, use este formato simples:
- ID [número] | [data] | [categoria] | áudio: [arquivo]

Ferramentas disponíveis:
- verificar_api: verifica se o sistema está online
- gerar_boletim: gera boletim com áudio
- confirmar_audio: confirma que o áudio foi gerado
- listar_historico: lista boletins já gerados
- ler_boletim: lê o texto completo de um boletim pelo id
- deletar_boletim: remove um boletim pelo id
- regenerar_audio: converte texto em fala

Categorias: geral, esportes, tecnologia, politica, economia, saude, ciencia, mundo.

Regras:
1. Sempre responda em português do Brasil.
2. Ao listar boletins, mostre apenas id, data, categoria e arquivo.
3. Ao gerar um boletim, siga SEMPRE esta sequência obrigatória:
   a. Chame gerar_boletim com os parâmetros solicitados.
   b. Chame confirmar_audio com o filename retornado para validar o áudio.
   c. Chame ler_boletim com o id retornado.
   d. Apresente a resposta final EXATAMENTE neste formato, sem inventar links:

      Boletim gerado com sucesso.
      ID: [id]
      Áudio: [filename] (disponível na pasta audio/ do sistema)

      [texto completo retornado por ler_boletim — copie integralmente, sem resumir, sem cortar]

4. NUNCA invente links, URLs ou caminhos que não foram retornados pelas ferramentas.
5. O texto do boletim deve aparecer COMPLETO e INTACTO, exatamente como retornado por ler_boletim."""

# ================================================
# SESSÃO MCP GLOBAL
# ================================================

class SessaoMCP:
    def __init__(self):
        self.session     = None
        self.tools       = []
        self.tools_names = []
        self._ctx_stack  = []

    async def iniciar(self):
        params = StdioServerParameters(
            command=SERVIDOR_PYTHON,
            args=[SERVIDOR_SCRIPT]
        )
        cm1 = stdio_client(params)
        read, write = await cm1.__aenter__()
        self._ctx_stack.append(cm1)

        cm2 = ClientSession(read, write)
        self.session = await cm2.__aenter__()
        self._ctx_stack.append(cm2)

        await self.session.initialize()
        tools_mcp        = await self.session.list_tools()
        self.tools       = tools_mcp.tools
        self.tools_names = [t.name for t in self.tools]
        registrar("sessao_iniciada", str(self.tools_names))

    async def encerrar(self):
        for cm in reversed(self._ctx_stack):
            try:
                await cm.__aexit__(None, None, None)
            except Exception:
                pass

    def tools_ollama(self):
        return [
            {
                "type": "function",
                "function": {
                    "name":        t.name,
                    "description": t.description or "",
                    "parameters":  t.inputSchema or {"type": "object", "properties": {}}
                }
            }
            for t in self.tools
        ]


sessao = SessaoMCP()

# ================================================
# CONVERSA COM OLLAMA
# ================================================

async def conversar(pergunta: str) -> str:
    historico = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user",   "content": pergunta}
    ]

    while True:
        try:
            resp = requests.post(OLLAMA_URL, json={
                "model":    MODELO,
                "messages": historico,
                "tools":    sessao.tools_ollama(),
                "stream":   False
            }, timeout=300).json()
        except requests.exceptions.Timeout:
            return "O modelo demorou para responder. Tente novamente."
        except Exception as e:
            return f"Erro de comunicação com o modelo: {e}"

        # Proteção contra resposta inesperada do Ollama
        if "message" not in resp:
            erro = resp.get("error", "Resposta inesperada do modelo.")
            registrar("erro_ollama", erro)
            return f"Erro do modelo: {erro}. Verifique se o Ollama está rodando com 'ollama ps'."

        msg = resp["message"]
        historico.append(msg)

        if msg.get("tool_calls"):
            for tc in msg["tool_calls"]:
                nome = tc["function"]["name"]
                args = tc["function"]["arguments"]
                try:
                    resultado = await sessao.session.call_tool(nome, args)
                    conteudo  = resultado.content[0].text if resultado.content else "sem resultado"
                    logger.info(json.dumps({
                        "timestamp": datetime.now().isoformat(),
                        "usuario": USUARIO_ATUAL,
                        "tool": nome, "args": args,
                        "sucesso": True, "resultado": conteudo[:300]
                    }, ensure_ascii=False))
                except Exception as e:
                    conteudo = f"Erro ao executar '{nome}': {e}"
                    logger.error(conteudo)
                historico.append({"role": "tool", "content": conteudo})
        else:
            registrar("resposta", msg["content"][:200])
            return msg["content"]

# ================================================
# FASTAPI
# ================================================

@asynccontextmanager
async def lifespan(app):
    # startup
    await sessao.iniciar()
    print(f"\n[Sistema] Interface do locutor iniciada.")
    print(f"[Sistema] Acesse: http://localhost:{PORTA_WEB}")
    print(f"[Sistema] Na rede local: http://IP-DA-MAQUINA:{PORTA_WEB}\n")
    yield
    # shutdown
    await sessao.encerrar()
    registrar("sessao_encerrada")

app = FastAPI(title="Boletim ON AIR — Assistente", lifespan=lifespan)

@app.post("/conversar")
async def endpoint_conversar(request: Request):
    dados = await request.json()
    pergunta = (dados.get("pergunta") or "").strip()
    if not pergunta:
        return JSONResponse({"resposta": "Por favor, digite uma pergunta."})
    registrar("pergunta", pergunta[:200])
    resposta = await conversar(pergunta)
    return JSONResponse({"resposta": resposta})

@app.get("/status")
async def status():
    try:
        r = requests.get(f"{BOLETIM_API_URL}/health", timeout=5)
        api_ok = r.status_code == 200
    except Exception:
        api_ok = False
    return JSONResponse({
        "api_boletim": "online" if api_ok else "offline",
        "tools": sessao.tools_names,
        "modelo": MODELO
    })

@app.get("/", response_class=HTMLResponse)
async def pagina_principal():
    return HTMLResponse(HTML_INTERFACE)

# ================================================
# HTML DA INTERFACE
# ================================================

HTML_INTERFACE = """<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Boletim ON AIR — Assistente</title>
<style>
  :root {
    --bg: #0a0e1a;
    --bg2: #111827;
    --border: #1e293b;
    --primary: #00d4ff;
    --text: #f1f5f9;
    --text2: #94a3b8;
    --success: #10b981;
    --error: #ef4444;
    --radius: 12px;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', system-ui, sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    padding: 24px;
    max-width: 800px;
    margin: 0 auto;
  }
  h1 {
    font-size: 1.6rem;
    color: var(--primary);
    margin-bottom: 6px;
    letter-spacing: 1px;
  }
  .subtitulo {
    color: var(--text2);
    font-size: 0.9rem;
    margin-bottom: 24px;
  }
  #conversa {
    flex: 1;
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 20px;
    min-height: 300px;
    max-height: 55vh;
    overflow-y: auto;
    margin-bottom: 20px;
    scroll-behavior: smooth;
  }
  .msg {
    margin-bottom: 16px;
    line-height: 1.7;
    font-size: 1rem;
  }
  .msg-voce {
    color: var(--primary);
    font-weight: 500;
  }
  .msg-voce::before { content: "Você: "; }
  .msg-sistema {
    color: var(--text);
    padding: 12px 16px;
    background: rgba(255,255,255,0.04);
    border-left: 3px solid var(--primary);
    border-radius: 0 var(--radius) var(--radius) 0;
    white-space: pre-wrap;
  }
  .msg-sistema::before {
    content: "Assistente: ";
    color: var(--text2);
    font-size: 0.85rem;
    display: block;
    margin-bottom: 4px;
  }
  .msg-aguarde {
    color: var(--text2);
    font-style: italic;
    animation: pisca 1s infinite;
  }
  @keyframes pisca { 0%,100%{opacity:1} 50%{opacity:0.4} }
  .entrada {
    display: flex;
    gap: 12px;
    align-items: flex-end;
  }
  #campo {
    flex: 1;
    background: var(--bg2);
    border: 2px solid var(--border);
    border-radius: var(--radius);
    padding: 14px 16px;
    color: var(--text);
    font-size: 1rem;
    font-family: inherit;
    resize: none;
    min-height: 52px;
    max-height: 120px;
    transition: border-color 0.2s;
    line-height: 1.5;
  }
  #campo:focus {
    outline: none;
    border-color: var(--primary);
  }
  #campo::placeholder { color: var(--text2); }
  #btn-enviar {
    background: var(--primary);
    color: #0a0e1a;
    border: none;
    border-radius: var(--radius);
    padding: 14px 24px;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    transition: opacity 0.2s;
    min-width: 100px;
  }
  #btn-enviar:disabled { opacity: 0.5; cursor: not-allowed; }
  #btn-enviar:hover:not(:disabled) { opacity: 0.85; }
  .dicas {
    margin-top: 20px;
    padding: 14px 16px;
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-size: 0.85rem;
    color: var(--text2);
    line-height: 1.8;
  }
  .dicas strong { color: var(--text); display: block; margin-bottom: 4px; }
  .status-bar {
    margin-top: 12px;
    font-size: 0.8rem;
    color: var(--text2);
    text-align: right;
  }
  .online { color: var(--success); }
  .offline { color: var(--error); }
  @media (max-width: 600px) {
    body { padding: 16px; }
    .entrada { flex-direction: column; }
    #btn-enviar { width: 100%; }
  }
</style>
</head>
<body>
<header>
  <h1>🎙️ BOLETIM ON AIR</h1>
  <p class="subtitulo">Assistente de voz com inteligência artificial local</p>
</header>

<main>
  <div
    id="conversa"
    role="log"
    aria-live="polite"
    aria-label="Histórico da conversa com o assistente"
  >
    <div class="msg msg-sistema" id="msg-boas-vindas">Olá! Estou pronto para ajudar.
Você pode me pedir para gerar boletins, listar o histórico, verificar o sistema e muito mais.
Digite sua solicitação abaixo e pressione Enter ou o botão Enviar.</div>
  </div>

  <div class="entrada">
    <textarea
      id="campo"
      placeholder="Ex: gera um boletim de esportes com 5 notícias"
      aria-label="Campo de mensagem. Digite sua solicitação e pressione Enter para enviar."
      rows="1"
    ></textarea>
    <button
      id="btn-enviar"
      aria-label="Enviar mensagem"
    >Enviar</button>
  </div>

  <div class="dicas" role="complementary" aria-label="Exemplos de solicitações">
    <strong>Exemplos de solicitações:</strong>
    Gera um boletim de esportes com 5 notícias &nbsp;·&nbsp;
    Lista o histórico de boletins &nbsp;·&nbsp;
    Lê o boletim de id 165 &nbsp;·&nbsp;
    Verifica se o sistema está online &nbsp;·&nbsp;
    Apaga o boletim de id 160
  </div>

  <div class="status-bar" id="status-bar" aria-live="polite">
    Verificando sistema...
  </div>
</main>

<script>
const conversa  = document.getElementById('conversa');
const campo     = document.getElementById('campo');
const btnEnviar = document.getElementById('btn-enviar');
const statusBar = document.getElementById('status-bar');

// Verifica status ao carregar
async function verificarStatus() {
  try {
    const r = await fetch('/status');
    const d = await r.json();
    const api = d.api_boletim === 'online';
    statusBar.innerHTML =
      `Modelo: ${d.modelo} &nbsp;·&nbsp; ` +
      `API: <span class="${api ? 'online' : 'offline'}">${d.api_boletim}</span> &nbsp;·&nbsp; ` +
      `${d.tools.length} ferramentas carregadas`;
  } catch {
    statusBar.innerHTML = '<span class="offline">Não foi possível verificar o status.</span>';
  }
}
verificarStatus();

// Adiciona mensagem na conversa
function addMsg(texto, tipo) {
  const div = document.createElement('div');
  div.className = `msg msg-${tipo}`;
  div.textContent = texto;
  conversa.appendChild(div);
  conversa.scrollTop = conversa.scrollHeight;
  return div;
}

// Ajusta altura do textarea automaticamente
campo.addEventListener('input', () => {
  campo.style.height = 'auto';
  campo.style.height = Math.min(campo.scrollHeight, 120) + 'px';
});

// Enter envia, Shift+Enter quebra linha
campo.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    enviar();
  }
});
btnEnviar.addEventListener('click', enviar);

async function enviar() {
  const pergunta = campo.value.trim();
  if (!pergunta || btnEnviar.disabled) return;

  addMsg(pergunta, 'voce');
  campo.value = '';
  campo.style.height = 'auto';
  campo.focus();

  btnEnviar.disabled = true;
  const aguarde = addMsg('Processando...', 'aguarde');

  try {
    const r = await fetch('/conversar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pergunta })
    });
    const d = await r.json();
    aguarde.remove();
    addMsg(d.resposta, 'sistema');
  } catch {
    aguarde.remove();
    addMsg('Erro ao comunicar com o servidor. Verifique se está rodando.', 'sistema');
  } finally {
    btnEnviar.disabled = false;
  }
}
</script>
</body>
</html>
"""

# ================================================
# INICIALIZAÇÃO
# ================================================

if __name__ == "__main__":
    # Verifica pré-requisitos
    erros = []
    if not Path(SERVIDOR_PYTHON).exists():
        erros.append(f"Python do venv não encontrado: {SERVIDOR_PYTHON}")
    if not Path(SERVIDOR_SCRIPT).exists():
        erros.append(f"servidor_mcp.py não encontrado: {SERVIDOR_SCRIPT}")
    if erros:
        for e in erros:
            print(f"[ERRO] {e}", file=sys.stderr)
        sys.exit(1)

    try:
        r = requests.get(f"{BOLETIM_API_URL}/health", timeout=5)
        print(f"[OK] Backend do Boletim online ({BOLETIM_API_URL})")
    except Exception:
        print(f"[AVISO] Backend não respondeu em {BOLETIM_API_URL}.")
        print("        Execute: docker compose up -d")

    uvicorn.run(app, host="0.0.0.0", port=PORTA_WEB, log_level="warning")