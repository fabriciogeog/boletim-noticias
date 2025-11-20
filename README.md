# 📻 Sistema de Boletim de Notícias

Sistema automatizado para geração de boletins de notícias, desenvolvido especialmente para acessibilidade e uso por locutores de rádio.

> **Arquitetura Leve e Rápida**: Funciona em qualquer máquina usando Docker, com processamento de notícias e áudio via APIs de nuvem.

---

## 🎯 Características Principais

- ✅ **Coleta Automática de Notícias** via API **GNews.io**
- 🎙️ **Geração de Áudio Rápida** com Text-to-Speech via **gTTS** (Voz do Google)
- ♿ **100% Acessível** com navegação por teclado e compatível com leitores de tela
- 🐋 **Docker** para instalação e execução simplificadas
- ⚡ **Extremamente Leve** - Não requer GPU ou hardware de IA.
- 🔄 **Cross-Platform** - Mesma arquitetura em Linux e Windows

---

## 📋 Requisitos

### Software
- **Docker Desktop** (Windows/Mac) ou **Docker Engine** (Linux)
- **Docker Compose** v1.29+
- **Navegador moderno** (Chrome, Firefox, Edge)

### Hardware Mínimo
- **RAM**: 2GB
- **Disco**: 1GB livre
- **CPU**: Qualquer processador 64-bit
- **Internet**: **Conexão de internet ativa é essencial** para coletar notícias (GNews) e gerar áudio (gTTS).

### 🔑 Chave de API (Obrigatório)

Este projeto **requer** uma chave de API do **GNews.io**.

1.  Cadastre-se no plano gratuito em [https://gnews.io/](https://gnews.io/)
2.  Copie sua Chave de API (API Key) do seu painel.
3.  Você precisará dela durante a instalação (Passo 2).

---

## 🚀 Instalação Rápida (Linux / macOS)

```bash
# 1. Clonar repositório
git clone [https://github.com/seu-usuario/boletim-noticias.git](https://github.com/seu-usuario/boletim-noticias.git)
cd boletim-noticias

# 2. Configurar sua Chave de API
# Copie o arquivo de exemplo
cp .env.example .env

# Abra o .env e cole sua chave do GNews
nano .env

# 3. Instalar e iniciar
make install
make start

# 4. Acessar
http://localhost:3000
