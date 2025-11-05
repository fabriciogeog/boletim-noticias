# 📻 Sistema de Boletim de Notícias

Sistema automatizado para geração de boletins de notícias com IA, desenvolvido especialmente para acessibilidade e uso por locutores de rádio.

> **Arquitetura Unificada**: Funciona identicamente em Linux e Windows usando Docker

---

## 🎯 Características Principais

- ✅ **Coleta Automática de Notícias** via RSS dos principais portais brasileiros
- 🤖 **Sumarização Inteligente** usando LLM local (Ollama)
- 🎙️ **Geração de Áudio** com Text-to-Speech em português brasileiro (gTTS)
- ♿ **100% Acessível** com navegação por teclado e compatível com leitores de tela
- 🐋 **Docker** para instalação e execução simplificadas
- 🔒 **Privacidade** - processamento local, dados não saem da máquina
- 🔄 **Cross-Platform** - mesma arquitetura em Linux e Windows

---

## 🚀 Instalação Rápida

### Linux / macOS
```bash
# Clonar repositório
git clone https://github.com/seu-usuario/boletim-noticias.git
cd boletim-noticias

# Instalar e iniciar
make install
make start

# Baixar modelo LLM
make setup-ollama

# Acessar
http://localhost:3000
```

### Windows
```powershell
# Extrair projeto
cd C:\Projetos\boletim-noticias

# Executar instalador (como Administrador)
.\install-windows.bat

# Acessar
http://localhost:3000
```

📖 **Guias Detalhados:**
- 🐧 [**Instalação no Linux**](LINUX.md) - Guia completo para Ubuntu/Debian/Fedora
- 🪟 [**Instalação no Windows**](WINDOWS.md) - Guia completo para Windows 10/11

---

## 📋 Requisitos

### Software
- **Docker Desktop** (Windows/Mac) ou **Docker Engine** (Linux)
- **Docker Compose** v1.29+
- **Navegador moderno** (Chrome, Firefox, Edge)

### Hardware
- **RAM**: 8GB mínimo (16GB recomendado)
- **Disco**: 30GB livres
- **CPU**: Processador moderno (i5/Ryzen 5 ou superior)
- **Internet**: Para coleta de notícias e download inicial

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────┐
│                   NAVEGADOR                      │
│              http://localhost:3000               │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│               FRONTEND (Nginx)                   │
│            Interface Acessível                   │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│            BACKEND API (FastAPI)                 │
│   • Coleta RSS                                   │
│   • Sumarização                                  │
│   • Geração TTS                                  │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│              OLLAMA (Docker)                     │
│           LLM Local - llama3:8b                  │
└─────────────────────────────────────────────────┘
```

**Todos os componentes rodam em Docker containers** - portabilidade garantida!

---

## 🎮 Uso Básico

### Comandos Linux/Mac (Makefile)
```bash
make start          # Iniciar sistema
make stop           # Parar sistema
make logs           # Ver logs
make status         # Status dos containers
make ollama-list    # Listar modelos LLM
make backup         # Backup dos dados
```

### Comandos Windows (Batch)
```powershell
.\comandos.bat start     # Iniciar sistema
.\comandos.bat stop      # Parar sistema
.\comandos.bat logs      # Ver logs
.\comandos.bat status    # Status dos containers
.\comandos.bat ollama    # Gerenciar modelos
```

### Interface Web

1. **Acesse**: http://localhost:3000
2. **Configure**: Marque categorias (Geral, Política, Economia...)
3. **Gere**: Clique em "Gerar Boletim" ou `Ctrl+Enter`
4. **Aguarde**: ~30-60 segundos
5. **Baixe**: MP3 gerado para usar no programa!

---

## ♿ Acessibilidade

Sistema projetado seguindo **WCAG 2.1**:

- ✅ Navegação 100% por teclado
- ✅ Compatível com NVDA, JAWS
- ✅ ARIA labels completos
- ✅ Feedback sonoro
- ✅ Alto contraste
- ✅ Skip links

### Atalhos de Teclado

| Atalho | Ação |
|--------|------|
| `Ctrl+Enter` | Gerar boletim |
| `Ctrl+E` | Editar texto |
| `Ctrl+D` | Baixar áudio |
| `Alt+1` a `Alt+4` | Navegação rápida |

---

## 🔧 Configurações

### Selecionar Modelo LLM

1. Acesse: **Configurações** no menu
2. Veja modelos disponíveis
3. Selecione o desejado
4. Salve configuração

### Modelos Recomendados

| Modelo | Tamanho | Velocidade | Qualidade | RAM Mínima |
|--------|---------|------------|-----------|------------|
| **gemma3:4b** | 3.3GB | Rápido | Boa | 8GB |
| **llama3:8b** | 4.7GB | Médio | Excelente | 12GB |
| **mistral:7b** | 4.4GB | Médio | Muito Boa | 10GB |

---

## 📊 Fontes de Notícias

- **G1** (Globo)
- **UOL Notícias**
- **CNN Brasil**
- **Folha de S.Paulo**

**Categorias:** Geral, Política, Economia, Esportes, Tecnologia, Mundo

---

## 🐛 Solução de Problemas

### Sistema não inicia
```bash
# Ver logs
make logs           # Linux
.\comandos.bat logs # Windows

# Reiniciar
make restart        # Linux
.\comandos.bat restart # Windows
```

### Sem modelos LLM
```bash
# Baixar modelo
make setup-ollama                               # Linux
docker exec boletim-ollama ollama pull llama3:8b # Ambos
```

### Porta em uso
Edite `docker-compose.yml` e mude as portas:
```yaml
ports:
  - "3001:3000"  # Frontend
  - "8001:8000"  # API
```

📖 **Mais soluções:** Veja guias específicos ([Linux](LINUX.md) / [Windows](WINDOWS.md))

---

## 📁 Estrutura do Projeto

```
boletim-noticias/
├── docker-compose.yml       # Orquestração (único para todos SOs)
├── Makefile                 # Comandos Linux/Mac
├── comandos.bat             # Comandos Windows
├── README.md                # Este arquivo
├── LINUX.md                 # Guia Linux
├── WINDOWS.md               # Guia Windows
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py
│       └── services/
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   └── src/
│       ├── index.html
│       ├── css/
│       └── js/
├── data/                    # Dados persistentes
└── audio/                   # Áudios gerados
```

---

## 🔄 Atualizações

### Linux/Mac
```bash
git pull
make update
```

### Windows
```powershell
git pull
.\comandos.bat update
```

---

## 💾 Backup

### Automático
```bash
make backup          # Linux
.\comandos.bat backup # Windows
```

Cria: `backup_YYYYMMDD_HHMMSS.tar.gz`

### Manual
Copie as pastas: `data/` e `audio/`

---

## 🤝 Contribuindo

Este é um projeto de código aberto. Contribuições são bem-vindas!

1. Fork o projeto
2. Crie sua feature branch
3. Commit suas mudanças
4. Push para o branch
5. Abra um Pull Request

---

## 📄 Licença

Este projeto é open-source sob licença MIT.

---

## 👥 Suporte

- 📖 [Guia Linux](LINUX.md)
- 🪟 [Guia Windows](WINDOWS.md)
- 🐛 Issues: GitHub Issues
- 💬 Discussões: GitHub Discussions

---

## 🎓 Tecnologias Utilizadas

- **Backend**: FastAPI, Python 3.11
- **Frontend**: HTML5, CSS3, JavaScript
- **LLM**: Ollama (llama3, gemma3, mistral)
- **TTS**: Google Text-to-Speech (gTTS)
- **Containerização**: Docker, Docker Compose
- **Web Server**: Nginx

---

## ✨ Versão

**v2.0.0** - Arquitetura Unificada (Novembro 2024)

- ✅ Ollama integrado no Docker
- ✅ Portabilidade Linux/Windows
- ✅ Seleção dinâmica de modelos
- ✅ Interface acessível aprimorada

---

**Desenvolvido com ❤️ para acessibilidade e usabilidade**
