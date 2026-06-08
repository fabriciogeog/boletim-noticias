# 🎙️ Boletim ON AIR

Sistema de geração de boletins de notícias com IA, desenvolvido para locutores de rádio com deficiência visual. Permite criar, narrar e gerenciar boletins via linguagem natural em um chat acessível, acessível de qualquer dispositivo na rede local.

---

## Arquitetura

```
[ Navegador / Smartphone ]
         │
         ▼
  [ nginx : 3001 ]  ←── Frontend estático (HTML/CSS/JS)
         │
         ├── /api/*   →  [ FastAPI : 8000 ]  ←── Docker
         │                    │
         │              SQLite + áudios MP3
         │
         └── /chat    →  [ interface_locutor.py : 5000 ]  ←── Host
                              │
                         [ servidor_mcp.py ]  ←── MCP tools
                              │
                    [ Groq API ] ou [ Ollama local ]
```

Dois containers Docker (`api` + `frontend`) + um processo Python no host (`interface_locutor.py`).

---

## Requisitos

- Docker e Docker Compose
- Python 3.11+ e [uv](https://github.com/astral-sh/uv) (para o processo no host)
- Ollama instalado localmente (opcional — apenas se usar modo local)

### Chaves de API

| Serviço | Uso | Obrigatório |
|---|---|---|
| [GNews](https://gnews.io) | Coleta de notícias | Sim |
| [Groq](https://console.groq.com) | Assistente IA (chat) e sumarização | Sim |
| [ElevenLabs](https://elevenlabs.io) | Narração premium | Não |

---

## Instalação

### 1. Configurar o `.env`

Copie o modelo e preencha as chaves:

```bash
cp .env.example .env   # ou edite o .env diretamente
```

Variáveis principais:

```env
GNEWS_API_KEY=sua_chave
GROQ_API_KEY=sua_chave
ELEVENLABS_API_KEY=sua_chave   # opcional

TTS_ENGINE=gtts                # gtts | elevenlabs
AI_SUMMARY_MODE=groq           # groq | local | none
LLM_MODO=groq                  # groq | ollama
GROQ_MODELO=meta-llama/llama-4-scout-17b-16e-instruct
```

### 2. Subir os containers Docker

```bash
docker compose up -d
```

Frontend: http://localhost:3001  
API: http://localhost:8000/docs

### 3. Iniciar o assistente IA (no host)

```bash
uv run python interface_locutor.py
```

---

## Acesso pela rede local (smartphone)

Acesse pelo IP da máquina host na porta 3001:

```
http://192.168.x.x:3001
```

Recomenda-se adicionar à tela inicial do celular para uso como app.

---

## Uso

A interface é um chat em linguagem natural. Exemplos de comandos:

- `gera um boletim de esportes com 5 notícias`
- `lista o histórico de boletins`
- `lê o boletim de id 42`
- `exclui todos os boletins com id menor ou igual a 100`
- `verifica o sistema`

### Atalhos de teclado

| Tecla | Ação |
|---|---|
| `Enter` | Enviar mensagem |
| `Shift+Enter` | Nova linha |
| `A+` / `A−` | Aumentar / diminuir fonte |

---

## Estrutura do projeto

```
boletim-noticias/
├── backend/app/        # FastAPI — coleta, sumarização, TTS, banco
├── frontend/src/       # Interface web (HTML/CSS/JS + nginx)
├── interface_locutor.py # Servidor do chat IA (porta 5000)
├── servidor_mcp.py     # Ferramentas MCP expostas ao LLM
├── audio/              # Arquivos MP3 gerados (não versionados)
├── data/               # Banco SQLite (não versionado)
├── docker-compose.yml
└── .env                # Configurações e chaves (não versionado)
```

---

Desenvolvido para promover a inclusão digital e a autonomia profissional de locutores com deficiência visual.
