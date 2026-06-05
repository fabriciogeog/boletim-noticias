import os
import httpx
from dotenv import load_dotenv
from fastmcp import FastMCP

load_dotenv()

API_BASE = os.getenv("BOLETIM_API_URL", "http://localhost:8000")

mcp = FastMCP("Boletim de Notícias")


async def _post(endpoint: str, payload: dict) -> dict:
    """Faz uma requisição POST ao FastAPI interno."""
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(f"{API_BASE}{endpoint}", json=payload)
        response.raise_for_status()
        return response.json()


async def _get(endpoint: str) -> dict | list:
    """Faz uma requisição GET ao FastAPI interno."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(f"{API_BASE}{endpoint}")
        response.raise_for_status()
        return response.json()


async def _delete(endpoint: str) -> dict:
    """Faz uma requisição DELETE ao FastAPI interno."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.delete(f"{API_BASE}{endpoint}")
        response.raise_for_status()
        return response.json()


# ================================================================
# TOOLS
# ================================================================

@mcp.tool()
async def gerar_boletim(
    categorias: list[str] = ["geral"],
    num_artigos: int = 10,
    estilo: str = "jornalistico",
    motor_tts: str = "gtts",
    modo_resumo: str = "none"
) -> dict:
    """Gera um boletim de notícias completo com áudio MP3.
    Use esta tool quando o usuário disser frases como:
    'gera um boletim', 'cria um boletim', 'quero ouvir notícias',
    'faz um boletim de esportes', 'gera 5 notícias de tecnologia'.
    Parâmetro categorias: lista com um ou mais temas.
    Valores aceitos para categorias: 'geral', 'esportes', 'tecnologia',
    'politica', 'economia', 'saude', 'ciencia', 'mundo', 'entretenimento'.
    Parâmetro num_artigos: quantidade de notícias (padrão 5, máximo 20).
    Parâmetro motor_tts: 'gtts' para voz Google gratuita ou
    'elevenlabs' para voz premium.
    Parâmetro modo_resumo: 'none' para texto direto, 'groq' para resumo por IA.
    Após gerar, sempre chame confirmar_audio com o filename retornado.
    Retorna id, nome do arquivo de áudio, categorias e prévia do texto."""
    try:
        resultado = await _post("/api/generate-boletim", {
            "categories": categorias,
            "num_articles": num_artigos,
            "style": estilo,
            "tts_engine": motor_tts,
            "summary_mode": modo_resumo,
            "include_intro": True,
            "include_outro": True
        })
        return {
            "id": resultado.get("id"),
            "audio": resultado.get("audio_filename"),
            "categorias": resultado.get("categories"),
            "texto_preview": resultado.get("summary_text", "")[:300] + "...",
            "status": "boletim gerado com sucesso"
        }
    except httpx.HTTPStatusError as e:
        return {"erro": f"API retornou status {e.response.status_code}: {e.response.text}"}
    except httpx.ConnectError:
        return {"erro": "Não foi possível conectar à API. Verifique se o Docker está rodando."}
    except Exception as e:
        return {"erro": str(e)}


@mcp.tool()
async def regenerar_audio(
    texto: str,
    motor_tts: str = "gtts"
) -> dict:
    """Converte um texto qualquer em arquivo de áudio MP3.
    Use esta tool quando o usuário disser frases como:
    'lê esse texto', 'narra esse conteúdo', 'converte em áudio',
    'gera áudio desse texto', 'quero ouvir esse texto',
    'regenera o áudio do boletim X com voz diferente'.
    Parâmetro texto: o conteúdo a ser narrado (obrigatório, máximo 5000 caracteres).
    Parâmetro motor_tts: 'gtts' para voz Google gratuita ou
    'elevenlabs' para voz premium.
    Retorna o nome do arquivo de áudio gerado e a URL de acesso."""
    if not texto.strip():
        return {"erro": "O texto não pode ser vazio."}
    try:
        resultado = await _post("/api/generate-audio", {
            "text": texto,
            "tts_engine": motor_tts
        })
        return {
            "audio": resultado.get("audio_filename"),
            "url": resultado.get("audio_url"),
            "status": "áudio gerado com sucesso"
        }
    except httpx.HTTPStatusError as e:
        return {"erro": f"API retornou status {e.response.status_code}: {e.response.text}"}
    except httpx.ConnectError:
        return {"erro": "Não foi possível conectar à API. Verifique se o Docker está rodando."}
    except Exception as e:
        return {"erro": str(e)}


@mcp.tool()
async def listar_historico() -> str:
    """Lista todos os boletins já gerados e salvos no sistema.
    Use esta tool quando o usuário fizer perguntas como:
    'quantos boletins foram gerados', 'quais boletins existem',
    'mostra o histórico', 'que boletins temos', 'boletins anteriores',
    'o que já foi gerado', 'lista os boletins', 'histórico de boletins'.
    Não use esta tool para gerar novos boletins.
    Retorna quantidade total e lista resumida de cada boletim."""
    try:
        boletins = await _get("/api/historico")
        if not boletins:
            return "Nenhum boletim gerado ainda."

        linhas = [f"Total: {len(boletins)} boletim(ns) gerado(s).\n"]
        for b in boletins[:20]:  # limita a 20 para não sobrecarregar
            data = b.get("timestamp", "")[:16] if b.get("timestamp") else "?"
            linhas.append(
                f"ID {b.get('id')} | {data} | "
                f"{b.get('categories', '?')} | "
                f"{b.get('audio_filename', 'sem áudio')}"
            )
        return "\n".join(linhas)

    except httpx.ConnectError:
        return "Erro: API não está respondendo. Verifique se o Docker está rodando."
    except Exception as e:
        return f"Erro: {str(e)}"


@mcp.tool()
async def deletar_boletim(id: int) -> dict:
    """Remove permanentemente um boletim do histórico e apaga o arquivo de áudio.
    Use esta tool quando o usuário disser frases como:
    'apaga o boletim', 'remove o boletim', 'deleta o boletim',
    'exclui o boletim de id X'.
    Parâmetro id: número inteiro identificador do boletim (obrigatório).
    Se o usuário não informar o id, chame listar_historico primeiro
    para mostrar os boletins disponíveis e seus ids.
    Atenção: esta operação é irreversível — o áudio também é excluído do disco."""
    try:
        resultado = await _delete(f"/api/historico/{id}")
        return resultado
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return {"erro": f"Boletim id={id} não encontrado."}
        return {"erro": f"API retornou status {e.response.status_code}"}
    except httpx.ConnectError:
        return {"erro": "Não foi possível conectar à API. Verifique se o Docker está rodando."}
    except Exception as e:
        return {"erro": str(e)}


@mcp.tool()
async def verificar_api() -> dict:
    """Verifica se o sistema de Boletim de Notícias está online e operacional.
    Use esta tool quando o usuário disser frases como:
    'o sistema está funcionando', 'verifica o sistema', 'está tudo ok',
    'sistema online', 'checa a API', 'diagnóstico'.
    Também use antes de gerar boletins se houver dúvida sobre disponibilidade.
    Retorna status, timestamp, motor de voz configurado, motor de resumo
    e quais chaves de API estão configuradas no sistema."""
    try:
        resultado = await _get("/health")
        config = await _get("/api/config")
        return {
            "status": resultado.get("status"),
            "timestamp": resultado.get("timestamp"),
            "tts_engine": config.get("TTS_ENGINE"),
            "summary_mode": config.get("AI_SUMMARY_MODE"),
            "gnews_configurado": bool(config.get("GNEWS_API_KEY")),
            "elevenlabs_configurado": bool(config.get("ELEVENLABS_API_KEY")),
            "groq_configurado": bool(config.get("GROQ_API_KEY"))
        }
    except httpx.ConnectError:
        return {"status": "offline", "erro": "API não está respondendo. Verifique se o Docker está rodando."}
    except Exception as e:
        return {"status": "erro", "erro": str(e)}


@mcp.tool()
async def confirmar_audio(filename: str) -> dict:
    """Confirma se um arquivo de áudio MP3 foi gerado e está disponível no servidor.
    Use esta tool sempre após chamar gerar_boletim ou regenerar_audio,
    passando o filename retornado por essas tools.
    Parâmetro filename: nome do arquivo MP3 (exemplo: boletim_20260524_123456.mp3).
    Retorna se o arquivo existe, seu tamanho em bytes e a URL de acesso.
    Se o arquivo não existir, retorna erro descritivo."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.head(
                f"{API_BASE}/audio/{filename}"
            )
            if response.status_code == 200:
                tamanho = response.headers.get("content-length", "desconhecido")
                return {
                    "existe": True,
                    "filename": filename,
                    "tamanho_bytes": tamanho,
                    "url": f"{API_BASE}/audio/{filename}",
                    "status": "áudio disponível"
                }
            return {
                "existe": False,
                "erro": f"Arquivo não encontrado (status {response.status_code})"
            }
    except Exception as e:
        return {"existe": False, "erro": str(e)}


# ================================================================
# RESOURCES
# ================================================================

@mcp.resource("categorias://disponiveis")
def categorias_disponiveis() -> str:
    """Lista as categorias de notícias disponíveis no GNews.
    A IA lê isso para sugerir opções ao usuário quando ele
    não especificar uma categoria."""
    return """
Categorias disponíveis no sistema de boletins (GNews):

- geral      : notícias gerais do dia
- esportes   : futebol, olimpíadas, esportes em geral
- tecnologia : inovação, startups, IA, gadgets
- politica   : governo, eleições, legislativo
- economia   : mercado, finanças, negócios
- saude      : medicina, bem-estar, ciência
"""


# Resource dinâmico — texto completo de um boletim
@mcp.resource("boletim://{id}/texto")
async def texto_boletim(id: int) -> str:
    """Retorna o texto completo de um boletim pelo id.
    Use quando o usuário quiser reler, analisar ou
    reprocessar o conteúdo de um boletim anterior."""
    try:
        boletins = await _get("/api/historico")
        boletim = next((b for b in boletins if b["id"] == id), None)
        if not boletim:
            return f"Boletim id={id} não encontrado no histórico."
        return boletim.get("summary_text", "Texto não disponível.")
    except Exception as e:
        return f"Erro ao buscar boletim: {str(e)}"


# ================================================================
# PROMPTS
# ================================================================

from fastmcp.prompts import Message

@mcp.prompt()
def gerar_boletim_guiado(
    categoria: str = "geral",
    num_noticias: int = 5
) -> list[Message]:
    """Inicia o fluxo completo de geração de boletim com
    verificação prévia da API e relatório final estruturado."""
    return [
        Message(
            role="user",
            content=f"""
Execute o fluxo completo de geração de boletim:
1. Verifique se a API está online com verificar_api()
2. Gere o boletim: categoria={categoria}, {num_noticias} notícias
3. Confirme o áudio gerado usando confirmar_audio() com o filename retornado
4. Informe o id do boletim e o status do áudio
"""
        )
    ]


# Prompt — modo especializado para o locutor
@mcp.prompt()
def modo_locutor() -> list[Message]:
    """Configura o assistente especificamente para uso
    pelo locutor cego. Define o contexto e as capacidades
    disponíveis de forma clara e acessível."""
    return [
        Message(
            role="user",
            content="Preciso que você atue como assistente do sistema de boletins."
        ),
        Message(
            role="assistant",
            content="""Pronto. Estou configurado para o sistema de boletins de notícias.

Posso ajudar com:
- Verificar se o sistema está online
- Gerar boletins por categoria e quantidade
- Regenerar áudios com voz diferente
- Consultar e gerenciar o histórico
- Confirmar arquivos de áudio gerados

Basta me dizer o que precisa em linguagem natural."""
        )
    ]


# Prompt — análise de boletim existente
@mcp.prompt()
def analisar_boletim(id: int) -> list[Message]:
    """Instrui a IA a ler e analisar o conteúdo de um
    boletim específico do histórico."""
    return [
        Message(
            role="user",
            content=f"""
Leia o conteúdo do boletim id={id} usando o resource boletim://{id}/texto e me forneça:

1. Resumo em 2 frases
2. Principais temas abordados
3. Estimativa de duração de leitura em voz alta (ritmo: 130 palavras por minuto)
"""
        )
    ]


# ================================================================
# APLICAÇÃO PRINCIPAL
# ================================================================

if __name__ == "__main__":
    transport = os.getenv("TRANSPORT", "stdio")
    if transport == "sse":
        port = int(os.getenv("PORT", 8001))
        mcp.run(transport="sse", host="0.0.0.0", port=port)
    else:
        mcp.run()