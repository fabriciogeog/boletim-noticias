import logging
from sqlalchemy import create_engine, Column, Integer, String, DateTime
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.orm import scoped_session
from datetime import datetime
import os

logger = logging.getLogger(__name__)

# O banco de dados será um único arquivo dentro da sua pasta de dados
DATABASE_FILE = "/app/data/boletim.db"
DATABASE_URL = f"sqlite:///{DATABASE_FILE}"

try:
    # Garante que o diretório /app/data exista
    os.makedirs(os.path.dirname(DATABASE_FILE), exist_ok=True)
    
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
    
    # Configuração para sessões de banco de dados
    db_session = scoped_session(sessionmaker(autocommit=False,
                                             autoflush=False,
                                             bind=engine))
    
    Base = declarative_base()
    Base.query = db_session.query_property()

except Exception as e:
    logger.error(f"✗ Erro fatal ao inicializar o banco de dados: {e}")
    engine = None
    db_session = None
    Base = declarative_base()


# --- Definição da Tabela do Histórico ---

class Boletim(Base):
    """
    Define a tabela 'boletins' no banco de dados.
    """
    __tablename__ = 'boletins'
    id = Column(Integer, primary_key=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    summary_text = Column(String, nullable=False)
    audio_filename = Column(String, nullable=True)
    categories = Column(String, nullable=True)

    def __repr__(self):
        return f'<Boletim {self.id} - {self.timestamp}>'

# --- Função de Inicialização ---

def init_db():
    """
    Cria a tabela no banco de dados se ela não existir.
    """
    if engine is None:
        logger.error("Motor de banco de dados não inicializado. Tabelas não podem ser criadas.")
        return
        
    try:
        logger.info("Inicializando o banco de dados e criando tabelas (se não existirem)...")
        Base.metadata.create_all(bind=engine)
        logger.info("✓ Banco de dados pronto.")
    except Exception as e:
        logger.error(f"✗ Erro ao criar tabelas do banco de dados: {e}")
