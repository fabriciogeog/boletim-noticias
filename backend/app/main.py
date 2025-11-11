from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
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
    version="3.0.0 (Leve)",
    on_startup=[init_db]  # <-- Cria o DB ao iniciar
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
class BoletimRequest(BaseModel):
    categories: List[str] = ["geral"]
    num_articles: int = 10
    style: str = "jornalistico"
    include_intro: bool = True
    include_outro: bool = True
    voice_name: Optional[str] = None

class AudioRequest(BaseModel):
    text: str

class BoletimResponse(BaseModel):
    id: int
    timestamp: datetime
    summary_text: str
    audio_filename: Optional[str] = None
    categories: Optional[str] = None
    
    class Config:
        from_attributes = True # CORREÇÃO: 'orm_mode' foi renomeado para 'from_attributes'

# ================================================================
# CORREÇÃO: Substituindo o @app.teardown_appcontext
# Esta é a forma correta do FastAPI de gerenciar a sessão do DB
# ================================================================
@app.middleware("http")
async def db_session_middleware(request: Request, call_next):
    """
    Garante que a sessão do banco de dados seja fechada
    após cada requisição.
    """
    response = await call_next(request)
    db_session.remove()
    return response

# --- Rotas Principais (Sem Alteração) ---
@app.get("/")
async def root():
    return {
        "message": "Boletim de Notícias API",
        "version": "3.0.0 (Leve)",
        "status": "running"
    }

@app.get("/health")
async def health_check():
    """Health check para Docker"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat()
    }

# --- Rota Modificada (generate_boletim) ---
@app.post("/api/generate-boletim", response_model=BoletimResponse)
async def generate_boletim(request: BoletimRequest):
    """
    Fluxo completo: coleta -> sumarização -> geração de áudio -> SALVAR NO DB
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
        
        audio_filename = os.path.basename(audio_path) if audio_path else None
        
        # 4. Salvar no Banco de Dados
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
            
            # Retorna o objeto recém-criado para o frontend
            return novo_boletim
            
        except Exception as db_error:
            logger.error(f"✗ Erro ao salvar boletim no banco de dados: {db_error}")
            db_session.rollback()
            # Retorna um objeto temporário para o frontend não quebrar
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

# --- Rota Modificada (generate_audio) ---
@app.post("/api/generate-audio")
async def generate_audio_from_text(request: AudioRequest):
    """
    Gera áudio a partir de um texto fornecido (regeneração).
    """
    try:
        logger.info(f"Iniciando regeneração de áudio: {len(request.text)} caracteres")
        
        if not request.text:
            raise HTTPException(status_code=400, detail="Texto vazio fornecido")
        
        audio_path = await tts_generator.generate(
            text=request.text,
            voice_name=None 
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

# --- Rota /api/download (Sem Alteração) ---
@app.get("/api/download/{filename}")
async def download_audio(filename: str):
    """
    Download do arquivo de áudio gerado
    """
    try:
        filename = os.path.basename(filename) # Sanitização
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

# ===============================================
# NOVAS ROTAS (Fase 2 - Histórico)
# ===============================================

@app.get("/api/historico", response_model=List[BoletimResponse])
async def get_historico():
    """
    Busca todos os boletins salvos no banco de dados,
    ordenados do mais recente para o mais antigo.
    """
    try:
        logger.info("Buscando histórico de boletins...")
        # Busca todos, ordena por ID decrescente (mais novo primeiro)
        boletins = db_session.query(BoletimModel).order_by(BoletimModel.id.desc()).all()
        return boletins
    except Exception as e:
        logger.error(f"Erro ao buscar histórico: {e}")
        return []

@app.delete("/api/historico/{boletim_id}", response_model=dict)
async def delete_boletim(boletim_id: int):
    """
    Exclui um registro de boletim do banco de dados E
    o arquivo de áudio associado do disco (limpeza manual).
    """
    try:
        logger.info(f"Tentando excluir boletim ID: {boletim_id}")
        
        # Encontra o registro no DB
        boletim_db = db_session.query(BoletimModel).get(boletim_id)
        
        if not boletim_db:
            logger.warning(f"Boletim ID {boletim_id} não encontrado no DB.")
            raise HTTPException(status_code=404, detail="Boletim não encontrado")

        audio_filename = boletim_db.audio_filename
        
        # 1. Deleta o registro do DB
        db_session.delete(boletim_db)
        db_session.commit()
        
        logger.info(f"✓ Registro ID {boletim_id} excluído do DB.")

        # 2. Deleta o arquivo de áudio (se existir)
        if audio_filename:
            try:
                file_path = Path("/app/audio") / os.path.basename(audio_filename)
                if file_path.exists():
                    file_path.unlink()
                    logger.info(f"✓ Arquivo de áudio {audio_filename} excluído do disco.")
                else:
                    logger.warning(f"Arquivo de áudio {audio_filename} não encontrado no disco (pode já ter sido excluído).")
            except Exception as e_file:
                logger.error(f"Erro ao excluir arquivo de áudio {audio_filename}: {e_file}")
                # Não falha a requisição se o arquivo não puder ser deletado
        
        return {"success": True, "message": f"Boletim ID {boletim_id} excluído."}

    except Exception as e:
        db_session.rollback()
        logger.error(f"Erro ao excluir boletim: {e}")
        raise HTTPException(status_code=500, detail=str(e))
