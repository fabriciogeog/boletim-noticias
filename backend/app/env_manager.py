import os
import logging
from typing import Dict

logger = logging.getLogger(__name__)

# O .env está um nível ACIMA da pasta /app onde este script roda
ENV_FILE_PATH = '../.env' 

def load_env_variables() -> Dict[str, str]:
    """
    Carrega variáveis específicas do .env para exibir no frontend.
    Por segurança, a chave de API é 'mascarada'.
    """
    config = {
        "GNEWS_API_KEY": "", # Placeholder
        "TTS_ENGINE": "com.br", # Padrão
        "ENABLE_OLLAMA": "false" # Padrão
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
                    value = value.strip().strip("'\"") # Remove aspas
                    
                    if key == 'GNEWS_API_KEY' and value:
                        # Segurança: Nunca envie a chave completa para o frontend
                        # Apenas enviamos um "indicador" de que ela está salva.
                        config[key] = f"{value[:4]}... (Salva)" 
                    elif key in config:
                        config[key] = value
                except Exception:
                    continue # Ignora linhas malformadas
                    
    return config

def update_env_file(updates: Dict[str, str]) -> bool:
    """
    Atualiza com segurança o arquivo .env, preservando linhas e comentários.
    'updates' é um dicionário como {'GNEWS_API_KEY': 'nova_chave', 'TTS_ENGINE': 'pt'}
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
                # Preserva comentários e linhas em branco
                if line.strip().startswith('#') or not line.strip():
                    f.write(line)
                    continue
                
                # Tenta encontrar a chave
                try:
                    key, old_value = line.split('=', 1)
                    key = key.strip()
                    
                    # Se esta é uma chave que queremos atualizar...
                    if key in updates:
                        new_value = updates[key]
                        f.write(f"{key}='{new_value}'\n") # Escreve o novo valor com aspas
                        keys_updated.add(key)
                    else:
                        f.write(line) # Escreve a linha antiga inalterada
                except ValueError:
                    f.write(line) # Escreve linha malformada (sem '=') como está

            # Adiciona chaves que estavam no 'updates' mas não no arquivo
            for key, value in updates.items():
                if key not in keys_updated:
                    f.write(f"{key}='{value}'\n")

        logger.info(f"Arquivo .env atualizado com as chaves: {list(updates.keys())}")
        return True
        
    except Exception as e:
        logger.error(f"Erro ao escrever no arquivo .env: {e}")
        return False
