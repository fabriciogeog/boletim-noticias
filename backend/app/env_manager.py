import os
import logging
from typing import Dict

logger = logging.getLogger(__name__)

ENV_FILE_PATH = '.env' 

def load_env_variables() -> Dict[str, str]:
    """
    Carrega variáveis do .env para exibir no frontend.
    Por segurança, a chave de API é 'mascarada'.
    """
    config = {
        "GNEWS_API_KEY": "",
        "GROQ_API_KEY": "",           # ← MUDADO: Groq em vez de Gemini
        "ELEVENLABS_API_KEY": "",
        "AI_SUMMARY_MODE": "groq",    # ← MUDADO: Padrão agora é groq
        "TTS_ENGINE": "gtts"
    }
    
    if not os.path.exists(ENV_FILE_PATH):
        logger.warning(f"Arquivo .env não encontrado em {ENV_FILE_PATH}. Usando padrões.")
        return config

    with open(ENV_FILE_PATH, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                try:
                    key, value = line.split('=', 1)
                    key = key.strip()
                    value = value.strip().strip("'\"")
                    
                    if key in config:
                        if "API_KEY" in key and value:
                            config[key] = f"{value[:4]}... (Salva)"
                        else:
                            config[key] = value
                except Exception:
                    continue
                    
    return config

def update_env_file(updates: Dict[str, str]) -> bool:
    """
    Atualiza com segurança o arquivo .env, preservando linhas e comentários.
    'updates' é um dicionário com as novas configurações.
    """
    if not os.path.exists(ENV_FILE_PATH):
        logger.error(f"Arquivo .env não encontrado em {ENV_FILE_PATH}. Não é possível salvar.")
        return False

    try:
        with open(ENV_FILE_PATH, 'r') as f:
            lines = f.readlines()

        keys_updated = set()
        
        with open(ENV_FILE_PATH, 'w') as f:
            for line in lines:
                if line.strip().startswith('#') or not line.strip():
                    f.write(line)
                    continue
                
                try:
                    key, old_value = line.split('=', 1)
                    key = key.strip()
                    
                    if key in updates:
                        new_value = updates[key]
                        if new_value is not None:
                            f.write(f"{key}={new_value}\n")  # ← SEM aspas
                            keys_updated.add(key)
                        else:
                            f.write(line)
                    else:
                        f.write(line)
                except ValueError:
                    f.write(line)
            
            # Adiciona chaves novas que não existiam
            for key, value in updates.items():
                if key not in keys_updated and value is not None:
                    f.write(f"{key}={value}\n")  # ← SEM aspas
        
        logger.info(f"Arquivo .env atualizado com as chaves: {list(updates.keys())}")
        return True
        
    except Exception as e:
        logger.error(f"Erro ao escrever no arquivo .env: {e}")
        return False
