from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
import logging
from datetime import datetime

from services.news_collector import NewsCollector
from services.summarizer import NewsSummarizer
from services.tts_generator import TTSGenerator

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Inicializar FastAPI
app = FastAPI(
    title="Boletim de Notícias API",
    description="API para coleta, sumarização e geração de áudio de notícias",
    version="1.0.0"
)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inicializar serviços
news_collector = NewsCollector()
summarizer = NewsSummarizer()
tts_generator = TTSGenerator()

# Modelos Pydantic
class NewsRequest(BaseModel):
    categories: List[str] = ["geral"]
    num_articles: int = 10
    sources: Optional[List[str]] = None

class BoletimRequest(BaseModel):
    categories: List[str] = ["geral"]
    num_articles: int = 10
    style: str = "jornalistico"  # jornalistico, conversacional
    include_intro: bool = True
    include_outro: bool = True
    voice_name: Optional[str] = None

# Rotas
@app.get("/")
async def root():
    return {
        "message": "Boletim de Notícias API",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/health")
async def health_check():
    """Health check para Docker"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat()
    }

@app.post("/api/collect-news")
async def collect_news(request: NewsRequest):
    """
    Coleta notícias dos feeds RSS
    """
    try:
        logger.info(f"Coletando notícias: {request.categories}")
        articles = await news_collector.collect(
            categories=request.categories,
            limit=request.num_articles,
            sources=request.sources
        )
        
        return {
            "success": True,
            "count": len(articles),
            "articles": articles
        }
    except Exception as e:
        logger.error(f"Erro ao coletar notícias: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/summarize")
async def summarize_news(articles: List[dict]):
    """
    Sumariza notícias usando Ollama
    """
    try:
        logger.info(f"Sumarizando {len(articles)} notícias")
        summary = await summarizer.summarize(articles)
        
        return {
            "success": True,
            "summary": summary
        }
    except Exception as e:
        logger.error(f"Erro ao sumarizar: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-boletim")
async def generate_boletim(request: BoletimRequest):
    """
    Fluxo completo: coleta -> sumarização -> geração de áudio
    """
    try:
        logger.info("Iniciando geração de boletim completo")
        
        # 1. Coletar notícias
        articles = await news_collector.collect(
            categories=request.categories,
            limit=request.num_articles
        )
        
        if not articles:
            raise HTTPException(status_code=404, detail="Nenhuma notícia encontrada")
        
        # 2. Sumarizar
        summary_text = await summarizer.summarize(
            articles=articles,
            style=request.style,
            include_intro=request.include_intro,
            include_outro=request.include_outro
        )
        
        # 3. Gerar áudio
        audio_path = await tts_generator.generate(
            text=summary_text,
            voice_name=request.voice_name
        )
        
        # Extrair apenas o nome do arquivo
        audio_filename = audio_path.split('/')[-1] if audio_path else None
        
        # Verificar se é MP3 (não é .txt)
        is_audio = audio_filename and audio_filename.endswith('.mp3')
        
        response_data = {
            "success": True,
            "articles_count": len(articles),
            "summary": summary_text,
        }
        
        # Adicionar campos de áudio apenas se for MP3
        if is_audio:
            response_data["audio_filename"] = audio_filename
            response_data["audio_file"] = audio_filename
            response_data["audio_url"] = f"/api/download/{audio_filename}"
            response_data["download_url"] = f"/api/download/{audio_filename}"
        else:
            response_data["audio_filename"] = None
            response_data["audio_file"] = audio_filename  # pode ser .txt
            response_data["text_file"] = audio_filename
        
        logger.info(f"Resposta: {response_data}")
        
        return response_data
        
    except Exception as e:
        logger.error(f"Erro ao gerar boletim: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/list-audio")
async def list_audio_files():
    """
    Lista arquivos de áudio gerados
    """
    try:
        from pathlib import Path
        import os
        
        audio_dir = Path("/app/audio")
        
        if not audio_dir.exists():
            return {"files": [], "count": 0}
        
        # Listar arquivos MP3, ordenar por data (mais recente primeiro)
        files = []
        for file in audio_dir.glob("*.mp3"):
            files.append({
                "name": file.name,
                "size": file.stat().st_size,
                "created": file.stat().st_mtime
            })
        
        files.sort(key=lambda x: x['created'], reverse=True)
        
        return {
            "files": [f['name'] for f in files],
            "count": len(files),
            "details": files
        }
    except Exception as e:
        logger.error(f"Erro ao listar áudios: {e}")
        return {"files": [], "count": 0, "error": str(e)}

@app.get("/api/download/{filename}")
async def download_audio(filename: str):
    """
    Download do arquivo de áudio gerado
    """
    try:
        import os
        from pathlib import Path
        
        # Sanitizar nome do arquivo
        filename = os.path.basename(filename)
        file_path = Path("/app/audio") / filename
        
        if not file_path.exists():
            logger.error(f"Arquivo não encontrado: {file_path}")
            raise HTTPException(status_code=404, detail="Arquivo não encontrado")
        
        logger.info(f"Enviando arquivo: {file_path}")
        
        return FileResponse(
            path=str(file_path),
            media_type="audio/mpeg",
            filename=filename
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao baixar áudio: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/sources")
async def list_sources():
    """
    Lista fontes de notícias disponíveis
    """
    return {
        "sources": news_collector.get_available_sources()
    }

@app.get("/api/voices")
async def list_voices():
    """
    Lista vozes TTS disponíveis
    """
    return {
        "voices": tts_generator.get_available_voices()
    }

@app.get("/api/ollama/models")
async def list_ollama_models():
    """
    Lista modelos Ollama disponíveis
    """
    try:
        import ollama
        response = ollama.list()
        models = [model['name'] for model in response.get('models', [])]
        
        return {
            "success": True,
            "models": models,
            "current": summarizer.model
        }
    except Exception as e:
        logger.error(f"Erro ao listar modelos Ollama: {e}")
        return {
            "success": False,
            "models": [],
            "current": summarizer.model,
            "error": str(e)
        }

@app.post("/api/ollama/set-model")
async def set_ollama_model(model_name: str):
    """
    Define o modelo Ollama a ser usado
    """
    try:
        summarizer.model = model_name
        logger.info(f"Modelo alterado para: {model_name}")
        
        return {
            "success": True,
            "model": model_name,
            "message": f"Modelo alterado para {model_name}"
        }
    except Exception as e:
        logger.error(f"Erro ao alterar modelo: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
