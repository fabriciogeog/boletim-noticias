# 📻 Sistema de Boletim de Notícias

Sistema automatizado para geração de boletins de notícias com IA, desenvolvido especialmente para acessibilidade e uso por locutores de rádio.

## 🎯 Características Principais

- ✅ **Coleta Automática de Notícias** via RSS dos principais portais brasileiros
- 🤖 **Sumarização Inteligente** usando LLM local (Ollama)
- 🎙️ **Geração de Áudio** com Text-to-Speech em português brasileiro
- ♿ **100% Acessível** com navegação por teclado e compatível com leitores de tela
- 🐋 **Docker** para instalação e execução simplificadas
- 🔒 **Privacidade** - processamento local sem dependências externas

---

## 📋 Pré-requisitos

- **Docker** (versão 20.10 ou superior)
- **Docker Compose** (versão 1.29 ou superior)
- **8GB de RAM** (mínimo recomendado)
- **20GB de espaço em disco** (para modelos de IA)

### Instalação do Docker

#### Windows
1. Baixe [Docker Desktop para Windows](https://www.docker.com/products/docker-desktop)
2. Execute o instalador e siga as instruções
3. Reinicie o computador quando solicitado

#### Linux (Ubuntu/Debian)
```bash
# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Adicionar usuário ao grupo docker
sudo usermod -aG docker $USER

# Instalar Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Reiniciar para aplicar mudanças
logout
```

#### macOS
1. Baixe [Docker Desktop para Mac](https://www.docker.com/products/docker-desktop)
2. Arraste para a pasta Aplicativos
3. Execute e siga as instruções

---

## 🚀 Instalação Rápida

### 1. Clone o Repositório
```bash
git clone https://github.com/seu-usuario/boletim-noticias.git
cd boletim-noticias
```

### 2. Instale o Sistema
```bash
make install
```

Este comando irá:
- Verificar dependências (Docker)
- Criar estrutura de diretórios
- Construir containers Docker
- Preparar ambiente

### 3. Inicie os Serviços
```bash
make start
```

### 4. Configure o Ollama (primeira vez)
```bash
make setup-ollama
```
⚠️ Este passo pode levar alguns minutos (download do modelo ~4GB)

### 5. Acesse o Sistema
Abra seu navegador em: **http://localhost:3000**

---

## 📖 Uso do Sistema

### Interface Principal

#### 1. Configurar Boletim
- Selecione **categorias** de notícias (Geral, Política, Economia, etc.)
- Defina **número de notícias** (recomendado: 5-10)
- Escolha o **estilo** (Jornalístico ou Conversacional)
- Marque opções: Introdução e Encerramento

#### 2. Gerar Boletim
- Clique em "**Gerar Boletim**" ou pressione **Ctrl+Enter**
- Aguarde o processamento (coleta → sumarização → áudio)
- O texto do boletim será exibido automaticamente

#### 3. Revisar e Editar
- Leia o texto gerado
- Clique em "**Editar Texto**" ou pressione **Ctrl+E** para fazer alterações
- Corrija nomes, siglas ou ajuste o conteúdo

#### 4. Áudio e Download
- Ouça o preview do áudio gerado
- Se editou o texto, clique em "**Regenerar Áudio**"
- Clique em "**Baixar Áudio**" ou pressione **Ctrl+D** para salvar o MP3

### Atalhos de Teclado

| Atalho | Ação |
|--------|------|
| `Ctrl + Enter` | Gerar boletim |
| `Ctrl + E` | Editar texto |
| `Ctrl + D` | Baixar áudio |
| `Alt + 1` | Ir para Gerar Boletim |
| `Alt + 2` | Ir para Histórico |
| `Alt + 3` | Ir para Configurações |
| `Alt + 4` | Ir para Ajuda |
| `Tab` | Navegar para próximo elemento |
| `Shift + Tab` | Navegar para elemento anterior |

---

## 🎛️ Comandos Make

O sistema usa **Makefile** para facilitar operações comuns:

```bash
make help              # Mostra todos os comandos disponíveis
make install           # Instala o sistema
make start             # Inicia serviços
make stop              # Para serviços
make restart           # Reinicia serviços
make logs              # Mostra logs em tempo real
make logs-api          # Logs apenas da API
make status            # Status dos containers
make setup-ollama      # Configura Ollama (primeira vez)
make test-api          # Testa API
make test-feeds        # Testa coleta de notícias
make clean             # Remove containers e volumes
make backup            # Faz backup dos dados
make update            # Atualiza sistema
make shell-api         # Abre terminal no container da API
```

---

## 🏗️ Arquitetura do Sistema

```
┌─────────────────────────────────────────────────┐
│                   FRONTEND                       │
│         (HTML5 + CSS + JavaScript)              │
│              http://localhost:3000               │
└──────────────────┬──────────────────────────────┘
                   │
                   │ API REST
                   │
┌──────────────────▼──────────────────────────────┐
│                BACKEND API                       │
│              (FastAPI/Python)                    │
│            http://localhost:8000                 │
│                                                  │
│  ┌─────────────┐  ┌─────────────┐              │
│  │   News      │  │  Summarizer │              │
│  │  Collector  │  │   (Ollama)  │              │
│  └─────────────┘  └─────────────┘              │
│                                                  │
│  ┌─────────────────────────────────┐           │
│  │     TTS Generator               │           │
│  │     (Coqui TTS)                 │           │
│  └─────────────────────────────────┘           │
└─────────────────────────────────────────────────┘
                   │
                   │
        ┌──────────▼───────────┐
        │   OLLAMA (LLM)       │
        │  http://localhost    │
        │       :11434         │
        └──────────────────────┘
```

### Componentes

1. **Frontend**: Interface acessível em HTML/CSS/JS
2. **Backend API**: FastAPI gerenciando fluxo de trabalho
3. **News Collector**: Coleta notícias via RSS
4. **Summarizer**: Sumariza usando Ollama (LLM local)
5. **TTS Generator**: Converte texto em áudio
6. **Ollama**: Motor de LLM rodando localmente

---

## 🔧 Configuração Avançada

### Fontes de Notícias

O sistema coleta de múltiplas fontes brasileiras:
- **G1** (Globo)
- **UOL Notícias**
- **Folha de S.Paulo**
- **Terra**
- **Estadão**

Categorias disponíveis:
- Geral
- Política
- Economia
- Esportes
- Tecnologia
- Mundo

### Personalização do LLM

Para usar modelos diferentes do Ollama:

```bash
# Listar modelos disponíveis
docker-compose exec ollama ollama list

# Baixar outro modelo
docker-compose exec ollama ollama pull gemma2

# Editar backend/app/services/summarizer.py
# Alterar: self.model = "gemma2"
```

### Personalização de Voz (TTS)

Edite `backend/app/services/tts_generator.py`:
- Ajustar velocidade de fala
- Trocar modelos TTS
- Configurar pronúncia de siglas

---

## 🐛 Solução de Problemas

### Container não inicia
```bash
# Ver logs detalhados
make logs

# Verificar status
make status

# Reconstruir containers
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Ollama não responde
```bash
# Verificar se modelo foi baixado
docker-compose exec ollama ollama list

# Rebaixar modelo
make setup-ollama

# Ver logs do Ollama
make logs-ollama
```

### API retorna erro 500
```bash
# Ver logs da API
make logs-api

# Entrar no container para debug
make shell-api

# Verificar saúde da API
make test-api
```

### Áudio não é gerado
```bash
# Verificar logs
make logs-api

# Pode ser falta de espaço em disco
df -h

# Limpar arquivos antigos
rm -rf audio/exports/*
```

### Port já em uso
Se as portas 3000 ou 8000 já estiverem em uso:

Edite `docker-compose.yml`:
```yaml
ports:
  - "3001:80"    # Mudar frontend para 3001
  - "8001:8000"  # Mudar API para 8001
```

---

## 📊 Monitoramento

### Ver recursos utilizados
```bash
make monitor
```

### Logs em tempo real
```bash
# Todos os serviços
make logs

# Apenas API
make logs-api

# Apenas Ollama
make logs-ollama
```

---

## 🔐 Backup e Restore

### Fazer backup
```bash
make backup
```
Cria arquivo `backup_YYYYMMDD_HHMMSS.tar.gz` com dados e áudios.

### Restaurar backup
```bash
tar -xzf backup_YYYYMMDD_HHMMSS.tar.gz
make restart
```

---

## 🚀 Atualização

Para atualizar o sistema:
```bash
make update
```

---

## 📝 Desenvolvimento

### Estrutura de Pastas
```
boletim-noticias/
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py
│       └── services/
│           ├── news_collector.py
│           ├── summarizer.py
│           └── tts_generator.py
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   └── src/
│       ├── index.html
│       ├── css/styles.css
│       └── js/
│           ├── app.js
│           └── accessibility.js
├── data/           # Dados persistentes
├── audio/          # Áudios gerados
├── docker-compose.yml
├── Makefile
└── README.md
```

### Modo Desenvolvimento
```bash
# Inicia com hot reload e logs visíveis
make dev
```

---

## ♿ Acessibilidade

O sistema foi projetado seguindo as diretrizes **WCAG 2.1**:

- ✅ Navegação completa por teclado
- ✅ Compatível com leitores de tela (NVDA, JAWS)
- ✅ Alto contraste
- ✅ Feedback sonoro para ações
- ✅ Labels e ARIA attributes em todos os elementos
- ✅ Skip links para navegação rápida
- ✅ Atalhos de teclado personalizados

---

## 📄 Licença

Este projeto é open-source. Sinta-se livre para usar, modificar e distribuir.

---

## 🤝 Suporte

Para dúvidas ou problemas:
1. Verifique a seção de **Solução de Problemas**
2. Consulte os **logs**: `make logs`
3. Abra uma issue no repositório

---

## 🎓 Créditos

Desenvolvido com foco em acessibilidade e usabilidade para locutores de rádio.

Tecnologias utilizadas:
- FastAPI
- Ollama (LLM)
- Coqui TTS
- Docker
- HTML5/CSS/JavaScript

---

**Versão**: 1.0.0  
**Última atualização**: Outubro 2024
