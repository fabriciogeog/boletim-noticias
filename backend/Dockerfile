FROM python:3.11-slim

# Instalar dependências do sistema para TTS e áudio
RUN apt-get update && apt-get install -y \
    curl \
    ffmpeg \
    libsndfile1 \
    espeak-ng \
    git \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Diretório de trabalho
WORKDIR /app

# Copiar requirements
COPY requirements.txt .

# Atualizar o PIP (para garantir que temos a versão mais recente do instalador)
RUN pip install --upgrade pip
# Instalar dependências Python
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código da aplicação
COPY ./app /app

# Criar diretórios necessários
RUN mkdir -p /app/data /app/audio /app/temp

# Expor porta
EXPOSE 8000

# Health check (CORRIGIDO: '|| exit 1' na mesma linha)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Comando para iniciar a aplicação
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
