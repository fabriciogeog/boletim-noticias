from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional, Dict
import logging
from datetime import datetime
import os
from pathlib import Path

# --- Importações do Projeto ---
from services.news_collector import NewsCollector
from services.summarizer import NewsSummarizer
from services.tts_generator import TTSGenerator

# --- Importações do Banco de Dados ---
from database import db_session, init_db, Boletim as BoletimModel

# --- Importação do Gerenciador de .env ---
import env_manager

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Evento de Inicialização
app = FastAPI(
    title="Boletim de Notícias API",
    description="API para coleta, sumarização e geração de áudio de notícias",
    version="4.0.0 (Híbrido)",
    on_startup=[init_db]
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

# ================================================================
# MODELOS PYDANTIC ATUALIZADOS
# ================================================================
class BoletimRequest(BaseModel):
    categories: List[str] = ["geral"]
    num_articles: int = 10
    style: str = "jornalistico"
    include_intro: bool = True
    include_outro: bool = True
    
    summary_mode: str = os.getenv("AI_SUMMARY_MODE", "none")
    tts_engine: str = os.getenv("TTS_ENGINE", "gtts")
    tts_voice_id: str = "21m00Tcm4TlvDq8ikWAM"
    tld: Optional[str] = "com.br"

class AudioRequest(BaseModel):
    text: str
    tts_engine: str = "gtts"
    tts_voice_id: str = "21m00Tcm4TlvDq8ikWAM"
    tld: Optional[str] = "com.br"

class BoletimResponse(BaseModel):
    id: int
    timestamp: datetime
    summary_text: str
    audio_filename: Optional[str] = None
    categories: Optional[str] = None
    
    class Config:
        from_attributes = True

# --- Modelos Pydantic para Configuração ---
class ConfigResponse(BaseModel):
    GNEWS_API_KEY: str
    GROQ_API_KEY: str
    ELEVENLABS_API_KEY: str
    AI_SUMMARY_MODE: str
    TTS_ENGINE: str

class ConfigSaveRequest(BaseModel):
    gnews_api_key: Optional[str] = None
    groq_api_key: Optional[str] = None
    elevenlabs_api_key: Optional[str] = None
    ai_summary_mode: str
    tts_engine: str

# Middleware do Banco de Dados
@app.middleware("http")
async def db_session_middleware(request: Request, call_next):
    response = await call_next(request)
    db_session.remove()
    return response

# --- Rotas Principais ---
@app.get("/")
async def root():
    return {
        "message": "Boletim de Notícias API",
        "version": "4.0.0 (Híbrido)",
        "status": "running"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

# --- Rotas de Geração ---
@app.post("/api/generate-boletim", response_model=BoletimResponse)
async def generate_boletim(request: BoletimRequest):
    try:
        logger.info("Iniciando geração de boletim completo")
        
        articles = await news_collector.collect(
            categories=request.categories,
            limit=request.num_articles
        )
        if not articles:
            raise HTTPException(status_code=404, detail="Nenhuma notícia encontrada")
        
        summary_text = await summarizer.summarize(
            articles=articles,
            style=request.style,
            include_intro=request.include_intro,
            include_outro=request.include_outro,
            summary_mode=request.summary_mode or os.getenv("AI_SUMMARY_MODE", "none")
        )
        
        audio_path = await tts_generator.generate(
            text=summary_text,
            tts_engine=request.tts_engine,
            tts_voice_id=request.tts_voice_id,
            tld=request.tld
        )
        
        audio_filename = os.path.basename(audio_path) if audio_path else None
        
        try:
            categories_str = ", ".join(request.categories)
            novo_boletim = BoletimModel(
                summary_text=summary_text,
                audio_filename=audio_filename,
                categories=categories_str
            )
            db_session.add(novo_boletim)
            db_session.commit()
            logger.info(f"✓ Boletim salvo no histórico (ID: {novo_boletim.id})")
            return novo_boletim
            
        except Exception as db_error:
            logger.error(f"✗ Erro ao salvar boletim no banco de dados: {db_error}")
            db_session.rollback()
            return BoletimResponse(
                id=0, 
                timestamp=datetime.utcnow(), 
                summary_text=summary_text,
                audio_filename=audio_filename,
                categories=", ".join(request.categories)
            )
        
    except HTTPException as e:
        logger.error(f"Erro HTTP ao gerar boletim: {e.detail}")
        raise e
    except Exception as e:
        logger.error(f"Erro inesperado ao gerar boletim: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-audio")
async def generate_audio_from_text(request: AudioRequest):
    try:
        logger.info(f"Iniciando regeneração de áudio: {len(request.text)} caracteres")
        if not request.text:
            raise HTTPException(status_code=400, detail="Texto vazio fornecido")
        
        audio_path = await tts_generator.generate(
            text=request.text,
            tts_engine=request.tts_engine,
            tts_voice_id=request.tts_voice_id,
            tld=request.tld
        )
        
        audio_filename = os.path.basename(audio_path) if audio_path else None
        is_audio = audio_filename and audio_filename.endswith('.mp3')
        
        if not is_audio:
            logger.error(f"Falha ao gerar arquivo MP3, fallback para texto: {audio_filename}")
            raise HTTPException(status_code=500, detail="Falha ao gerar arquivo de áudio")
        
        logger.info(f"Áudio regenerado com sucesso: {audio_filename}")
        
        return {
            "success": True,
            "audio_filename": audio_filename,
            "download_url": f"/api/download/{audio_filename}",
            "audio_url": f"/api/download/{audio_filename}"
        }
        
    except Exception as e:
        logger.error(f"Erro ao regenerar áudio: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/download/{filename}")
async def download_audio(filename: str):
    try:
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

# --- Rotas do Histórico ---
@app.get("/api/historico", response_model=List[BoletimResponse])
async def get_historico():
    """
    Busca todos os boletins salvos no banco de dados.
    """
    try:
        logger.info("Buscando histórico de boletins...")
        boletins = db_session.query(BoletimModel).order_by(BoletimModel.id.desc()).all()
        return boletins
    except Exception as e:
        logger.error(f"Erro ao buscar histórico: {e}")
        return []

@app.delete("/api/historico/{boletim_id}", response_model=dict)
async def delete_boletim(boletim_id: int):
    """
    Exclui um registro de boletim do banco de dados E
    o arquivo de áudio associado do disco.
    """
    try:
        logger.info(f"Tentando excluir boletim ID: {boletim_id}")
        
        boletim_db = db_session.query(BoletimModel).get(boletim_id)
        
        if not boletim_db:
            logger.warning(f"Boletim ID {boletim_id} não encontrado no DB.")
            raise HTTPException(status_code=404, detail="Boletim não encontrado")
        
        audio_filename = boletim_db.audio_filename
        
        db_session.delete(boletim_db)
        db_session.commit()
        
        logger.info(f"✓ Registro ID {boletim_id} excluído do DB.")
        
        if audio_filename:
            try:
                file_path = Path("/app/audio") / os.path.basename(audio_filename)
                if file_path.exists():
                    file_path.unlink()
                    logger.info(f"✓ Arquivo de áudio {audio_filename} excluído do disco.")
                else:
                    logger.warning(f"Arquivo de áudio {audio_filename} não encontrado no disco.")
            except Exception as e_file:
                logger.error(f"Erro ao excluir arquivo de áudio {audio_filename}: {e_file}")
        
        return {"success": True, "message": f"Boletim ID {boletim_id} excluído."}
    except Exception as e:
        db_session.rollback()
        logger.error(f"Erro ao excluir boletim: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- Rotas de Configuração ---
@app.get("/api/config", response_model=ConfigResponse)
async def get_configuracoes():
    """
    Carrega as configurações atuais do arquivo .env.
    Envia uma chave de API mascarada por segurança.
    """
    try:
        logger.info("Carregando configurações do .env para o frontend...")
        config = env_manager.load_env_variables()
        return config
    except Exception as e:
        logger.error(f"Erro ao carregar configurações: {e}")
        raise HTTPException(status_code=500, detail="Erro ao carregar configurações.")

@app.post("/api/config", response_model=dict)
async def save_configuracoes(request: ConfigSaveRequest):
    """
    Recebe as configurações do frontend e salva no arquivo .env.
    """
    try:
        logger.info("Salvando novas configurações no .env...")
        updates = {}
        
        if request.gnews_api_key:
            updates['GNEWS_API_KEY'] = request.gnews_api_key
        if request.groq_api_key:
            updates['GROQ_API_KEY'] = request.groq_api_key
        if request.elevenlabs_api_key:
            updates['ELEVENLABS_API_KEY'] = request.elevenlabs_api_key
        
        updates['AI_SUMMARY_MODE'] = request.ai_summary_mode
        updates['TTS_ENGINE'] = request.tts_engine
        
        success = env_manager.update_env_file(updates)
        
        if not success:
            raise HTTPException(status_code=500, detail="Erro ao salvar o arquivo .env no servidor.")
        
        # Recarregar os serviços com as novas chaves/configurações
        news_collector.api_key = os.getenv("GNEWS_API_KEY")
        summarizer.__init__()
        tts_generator.__init__()
        
        return {"success": True, "message": "Configurações salvas!"}
        
    except Exception as e:
        logger.error(f"Erro ao salvar configurações: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- Rota para servir áudio ---
@app.get("/audio/{filename}")
async def serve_audio(filename: str):
    """
    Serve arquivos de áudio gerados
    """
    audio_path = Path("/app/audio") / filename
    
    if not audio_path.exists():
        logger.error(f"Arquivo de áudio não encontrado: {filename}")
        raise HTTPException(status_code=404, detail="Arquivo de áudio não encontrado")
    
    return FileResponse(
        path=str(audio_path),
        media_type="audio/mpeg",
        filename=filename
    )
