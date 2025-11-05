# 🪟 Guia de Instalação - Windows 10/11

## Sistema de Boletim de Notícias

---

## 📋 Requisitos Mínimos

- **Sistema**: Windows 10/11 (64-bit)
- **RAM**: 8GB (recomendado 16GB)
- **Disco**: 30GB livres
- **Processador**: Intel i5 ou AMD Ryzen 5 (ou superior)
- **Internet**: Para download inicial

---

## 🚀 Instalação Passo a Passo

### Etapa 1: Instalar Software Necessário

#### 1.1 Windows Subsystem for Linux (WSL2)

1. Abra **PowerShell** como Administrador
2. Execute:
   ```powershell
   wsl --install
   ```
3. **Reinicie o computador**
4. Após reiniciar, verifique:
   ```powershell
   wsl --list --verbose
   ```

#### 1.2 Docker Desktop

1. Acesse: https://www.docker.com/products/docker-desktop/
2. Clique em **Download for Windows**
3. Execute o instalador: `Docker Desktop Installer.exe`
4. Durante instalação:
   - ✅ Marque "Use WSL 2 instead of Hyper-V"
5. **Reinicie** quando solicitado
6. Abra **Docker Desktop**
7. Aguarde até aparecer "Docker is running"
8. Verifique no PowerShell:
   ```powershell
   docker --version
   docker-compose --version
   ```

#### 1.3 Git for Windows

1. Acesse: https://git-scm.com/download/win
2. Baixe e execute o instalador
3. Durante instalação (aceite padrões)
4. Verifique:
   ```powershell
   git --version
   ```

#### 1.4 Ollama

1. Acesse: https://ollama.com/download/windows
2. Baixe e execute: `OllamaSetup.exe`
3. Ollama inicia automaticamente como serviço
4. Abra PowerShell e baixe um modelo:
   ```powershell
   ollama pull llama3:8b
   ```
5. Verifique:
   ```powershell
   ollama list
   ```

---

### Etapa 2: Obter o Projeto

#### Opção A: Via Git (Recomendado)

```powershell
# Criar pasta de projetos
mkdir C:\Projetos
cd C:\Projetos

# Clonar repositório
git clone https://github.com/seu-usuario/boletim-noticias.git
cd boletim-noticias
```

#### Opção B: Via Arquivo Compactado

1. Receba o arquivo `boletim-noticias.zip`
2. Extraia para: `C:\Projetos\boletim-noticias\`
3. Abra PowerShell na pasta:
   ```powershell
   cd C:\Projetos\boletim-noticias
   ```

---

### Etapa 3: Instalar Sistema

#### Instalação Automática (Recomendado)

1. Clique com **botão direito** em `install-windows.bat`
2. Selecione **"Executar como administrador"**
3. Aguarde o processo (5-10 minutos)
4. Quando terminar, sistema estará rodando!

#### Instalação Manual

```powershell
# 1. Criar estrutura
mkdir data\boletins, data\config, audio\exports -Force

# 2. Build
docker-compose build

# 3. Iniciar
docker-compose up -d

# 4. Verificar
docker-compose ps
```

---

### Etapa 4: Acessar Sistema

1. Abra navegador
2. Acesse: **http://localhost:3000**
3. Pronto! Sistema funcionando!

---

## 🎮 Usando o Sistema

### Comandos Básicos

Abra PowerShell na pasta do projeto:

```powershell
# Iniciar sistema
.\comandos.bat start

# Ver logs
.\comandos.bat logs

# Parar sistema
.\comandos.bat stop

# Ver status
.\comandos.bat status

# Reiniciar
.\comandos.bat restart
```

### Gerando Primeiro Boletim

1. Abra: http://localhost:3000
2. Marque categorias (ex: Geral)
3. Configure número de notícias (5-8)
4. Clique em **"Gerar Boletim"** ou `Ctrl+Enter`
5. Aguarde processamento (~30-60s)
6. Baixe o áudio gerado!

---

## 🔧 Solução de Problemas

### "Docker não encontrado"

- Certifique-se que Docker Desktop está **rodando**
- Veja ícone na bandeja do sistema (deve estar verde)
- Reinicie Docker Desktop

### "Porta já em uso"

Outra aplicação está usando porta 3000 ou 8000:

1. Pare o sistema: `.\comandos.bat stop`
2. Edite `docker-compose.yml`
3. Mude portas:
   ```yaml
   ports:
     - "3001:3000"  # Frontend na porta 3001
     - "8001:8000"  # API na porta 8001
   ```
4. Inicie novamente

### "Ollama não conecta"

Verifique se Ollama está rodando:

```powershell
# Ver processo
Get-Process ollama

# Se não estiver, inicie
ollama serve
```

### Sistema lento

- Verifique RAM disponível (Task Manager)
- Feche aplicações desnecessárias
- Considere usar modelo menor: `gemma3` ao invés de `llama3:8b`

---

## 📱 Acessibilidade

### Configurar NVDA (Leitor de Tela)

1. Baixe NVDA: https://www.nvaccess.org/download/
2. Instale e inicie
3. Abra sistema: http://localhost:3000
4. Navegue com `Tab` entre elementos
5. Use atalhos:
   - `Ctrl+Enter`: Gerar boletim
   - `Ctrl+E`: Editar texto
   - `Ctrl+D`: Baixar áudio

### Atalhos de Teclado

| Atalho | Ação |
|--------|------|
| `Tab` / `Shift+Tab` | Navegar |
| `Ctrl+Enter` | Gerar boletim |
| `Ctrl+E` | Editar texto |
| `Ctrl+D` | Download áudio |
| `Alt+1` | Ir para Gerar |
| `Alt+2` | Ir para Histórico |
| `Alt+3` | Ir para Configurações |

---

## 🔄 Atualizações

### Atualizar Sistema

```powershell
# Via Git
git pull

# Atualizar containers
.\comandos.bat update
```

### Backup

```powershell
# Criar backup
.\comandos.bat backup

# Cria arquivo: backup_YYYYMMDD_HHMMSS.tar.gz
```

---

## 📞 Suporte

### Logs

Ver o que está acontecendo:

```powershell
.\comandos.bat logs
```

### Reiniciar Tudo

Se algo der errado:

```powershell
.\comandos.bat stop
.\comandos.bat clean
.\comandos.bat start
```

---

## 🎯 Checklist Pré-Teste

Antes de testar com seu amigo:

- [ ] WSL2 instalado e funcionando
- [ ] Docker Desktop rodando (ícone verde)
- [ ] Ollama instalado e com modelo
- [ ] Git instalado (se usar)
- [ ] Projeto na pasta `C:\Projetos\boletim-noticias`
- [ ] Sistema iniciado: `.\comandos.bat start`
- [ ] Navegador abrindo: http://localhost:3000
- [ ] Geração de boletim funcionando
- [ ] Download de áudio OK
- [ ] NVDA instalado (se necessário)

---

## 💡 Dicas

1. **Primeira geração é mais lenta** (Ollama carrega modelo)
2. **Deixe Docker sempre rodando** durante uso
3. **Use modelo menor** se máquina for lenta (gemma3)
4. **Faça backup** antes de atualizar
5. **Teste NVDA** antes da sessão com seu amigo

---

## 📊 Recursos Utilizados

Durante uso normal:

- **RAM**: ~4-6GB
- **CPU**: 10-30% (picos durante geração)
- **Disco**: ~15-20GB
- **Rede**: Apenas para coletar notícias

---

## 🎓 Treinamento Básico

### Para o Usuário Final

1. **Iniciar sistema** (duplo clique em atalho)
2. **Abrir navegador** (http://localhost:3000)
3. **Configurar boletim** (categorias, qtd. notícias)
4. **Gerar** (`Ctrl+Enter`)
5. **Aguardar** (~1 minuto)
6. **Revisar texto** (pode editar)
7. **Baixar áudio** (`Ctrl+D`)
8. **Usar no programa de rádio**!

---

## ✅ Sistema Pronto para Produção!

Após instalar e testar, o sistema está pronto para uso diário!

**Versão**: 1.0.0  
**Última atualização**: Novembro 2024