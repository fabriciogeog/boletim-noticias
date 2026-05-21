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
    """Gera um boletim de notícias completo com áudio.
    Use quando o usuário pedir para gerar, criar ou produzir um boletim.
    categorias: lista de temas como 'geral', 'esportes', 'tecnologia', 'politica'.
    motor_tts: 'gtts' para voz Google (gratuito) ou 'elevenlabs' para voz premium.
    modo_resumo: 'none' para texto bruto, 'groq' para sumarização via IA.
    Retorna o id do boletim, o texto e o nome do arquivo de áudio gerado."""
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
    """Gera um novo arquivo de áudio a partir de um texto fornecido.
    Use quando o usuário quiser ouvir um texto específico, renarrar
    um boletim com voz diferente, ou converter texto em fala.
    motor_tts: 'gtts' para voz Google ou 'elevenlabs' para voz premium."""
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
async def listar_historico() -> list[dict]:
    """Lista todos os boletins gerados anteriormente com id, data e categorias.
    Use quando o usuário perguntar sobre boletins anteriores, quiser ver
    o histórico ou precisar do id de um boletim para outra operação."""
    try:
        boletins = await _get("/api/historico")
        return [
            {
                "id": b.get("id"),
                "data": b.get("timestamp"),
                "categorias": b.get("categories"),
                "audio": b.get("audio_filename"),
                "preview": b.get("summary_text", "")[:150] + "..."
            }
            for b in boletins
        ]
    except httpx.ConnectError:
        return [{"erro": "Não foi possível conectar à API. Verifique se o Docker está rodando."}]
    except Exception as e:
        return [{"erro": str(e)}]


@mcp.tool()
async def deletar_boletim(id: int) -> dict:
    """Remove um boletim do histórico e exclui o arquivo de áudio associado.
    Use quando o usuário pedir para apagar, remover ou excluir um boletim.
    Requer o id do boletim — use listar_historico() primeiro se necessário."""
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
    """Verifica se a API do Boletim está online e saudável.
    Use quando o usuário perguntar se o sistema está funcionando,
    antes de gerar boletins, ou para diagnóstico de problemas."""
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
    """Confirma se um arquivo de áudio foi gerado e está disponível.
    Use após gerar um boletim para validar que o áudio existe."""
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
