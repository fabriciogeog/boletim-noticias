# 🪟 Guia de Instalação - Windows 10/11

Sistema de Boletim de Notícias para Windows com instalação simplificada via Docker.

---

## 📋 Requisitos

### Sistema Operacional
- Windows 10 Pro/Enterprise/Education (64-bit)
- Windows 11 (qualquer edição 64-bit)
- WSL 2 habilitado

### Hardware Mínimo
- **RAM**: 8GB (16GB recomendado)
- **Disco**: 30GB livres (SSD recomendado)
- **CPU**: Intel i5 / AMD Ryzen 5 ou superior (64-bit com virtualização)

---

## 🚀 Instalação Completa

### Método 1: Instalador Automático (Recomendado)

1. **Extrair projeto** para `C:\Projetos\boletim-noticias`
2. **Clicar com botão direito** em `install-windows.bat`
3. **Selecionar** "Executar como administrador"
4. **Aguardar** instalação (~10-15 minutos)
5. **Pronto!**

### Método 2: Passo a Passo Manual

#### Passo 1: Instalar WSL 2

```powershell
# PowerShell como Administrador
wsl --install

# Reiniciar computador
Restart-Computer
```

Após reiniciar:
```powershell
# Verificar instalação
wsl --list --verbose
```

#### Passo 2: Instalar Docker Desktop

1. **Baixar**: https://www.docker.com/products/docker-desktop/
2. **Executar**: `Docker Desktop Installer.exe`
3. **Durante instalação**:
   - ✅ "Use WSL 2 instead of Hyper-V"
   - ✅ "Add shortcut to desktop"
4. **Reiniciar** quando solicitado
5. **Abrir Docker Desktop** e aguardar inicialização

Verificar:
```powershell
docker --version
docker-compose --version
docker ps
```

#### Passo 3: Instalar Git (Opcional)

Se quiser usar Git:
1. **Baixar**: https://git-scm.com/download/win
2. **Executar instalador** (aceitar padrões)
3. **Verificar**:
   ```powershell
   git --version
   ```

#### Passo 4: Obter Projeto

**Via Git:**
```powershell
mkdir C:\Projetos
cd C:\Projetos
git clone https://github.com/seu-usuario/boletim-noticias.git
cd boletim-noticias
```

**Via ZIP:**
1. Extrair `boletim-noticias.zip` para `C:\Projetos\boletim-noticias`
2. Abrir PowerShell na pasta

#### Passo 5: Instalar Sistema

```powershell
# Criar estrutura
mkdir data\boletins, data\config, audio\exports -Force

# Build dos containers
docker-compose build

# Iniciar sistema
docker-compose up -d

# Aguardar inicialização
Start-Sleep -Seconds 30

# Baixar modelo LLM
docker exec boletim-ollama ollama pull llama3:8b

# Verificar
docker-compose ps
```

#### Passo 6: Acessar Sistema

Abrir navegador: **http://localhost:3000**

---

## 🎮 Usando o Sistema

### Comandos Batch

Abrir PowerShell na pasta do projeto:

```powershell
# Iniciar sistema
.\comandos.bat start

# Ver logs em tempo real
.\comandos.bat logs

# Ver status
.\comandos.bat status

# Parar sistema
.\comandos.bat stop

# Reiniciar
.\comandos.bat restart

# Gerenciar modelos Ollama
.\comandos.bat ollama

# Fazer backup
.\comandos.bat backup

# Limpar tudo
.\comandos.bat clean
```

### Gerenciar Modelos LLM

```powershell
# Listar modelos instalados
docker exec boletim-ollama ollama list

# Baixar modelo
docker exec boletim-ollama ollama pull gemma3:4b

# Modelos disponíveis:
# - gemma3:4b (3.3GB) - Rápido, bom para 8GB RAM
# - llama3:8b (4.7GB) - Balanceado, recomendado
# - mistral:7b (4.4GB) - Ótima qualidade
# - gemma3:27b (17GB) - Melhor qualidade, requer 24GB+ RAM
```

### Atalhos de Desktop (Opcional)

Criar atalhos para facilitar:

**Iniciar Sistema:**
1. Botão direito no Desktop → Novo → Atalho
2. Local: `powershell.exe -Command "cd C:\Projetos\boletim-noticias; .\comandos.bat start; pause"`
3. Nome: "Iniciar Boletim"

**Abrir Sistema:**
1. Botão direito no Desktop → Novo → Atalho
2. Local: `http://localhost:3000`
3. Nome: "Boletim de Notícias"

---

## 🔧 Configurações

### Portas Personalizadas

Se portas 3000 ou 8000 estiverem em uso:

Editar `docker-compose.yml`:
```yaml
services:
  frontend:
    ports:
      - "3001:3000"  # Muda para porta 3001
  api:
    ports:
      - "8001:8000"  # Muda para porta 8001
```

Reiniciar:
```powershell
.\comandos.bat restart
```

### Firewall Windows

Se tiver problemas de conexão:

```powershell
# PowerShell como Administrador
New-NetFirewallRule -DisplayName "Boletim - Frontend" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Boletim - API" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Boletim - Ollama" -Direction Inbound -LocalPort 11434 -Protocol TCP -Action Allow
```

---

## 🐛 Solução de Problemas

### Docker Desktop não inicia

**Problema:** "Docker Desktop starting..." infinito

**Solução:**
```powershell
# 1. Fechar Docker Desktop completamente
taskkill /F /IM "Docker Desktop.exe"

# 2. Limpar dados
Remove-Item -Recurse -Force "$env:APPDATA\Docker"

# 3. Reiniciar WSL
wsl --shutdown

# 4. Abrir Docker Desktop novamente
```

### WSL 2 não funciona

**Problema:** "WSL 2 installation is incomplete"

**Solução:**
```powershell
# PowerShell como Administrador
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

# Reiniciar
Restart-Computer

# Após reiniciar, baixar e instalar:
# https://wslstorestorage.blob.core.windows.net/wslblob/wsl_update_x64.msi
```

### Containers não iniciam

**Problema:** Containers param logo após iniciar

**Solução:**
```powershell
# Ver logs detalhados
docker-compose logs

# Reconstruir sem cache
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### "Port is already allocated"

**Problema:** Porta já em uso

**Solução:**
```powershell
# Ver o que está usando a porta
netstat -ano | findstr :3000
netstat -ano | findstr :8000

# Anotar PID e matar processo
taskkill /PID <PID> /F

# Ou mudar porta no docker-compose.yml
```

### Ollama sem modelos

**Problema:** "model not found" ao gerar boletim

**Solução:**
```powershell
# Ver modelos instalados
docker exec boletim-ollama ollama list

# Se vazio, baixar modelo
docker exec boletim-ollama ollama pull llama3:8b

# Verificar novamente
docker exec boletim-ollama ollama list
```

### Sistema lento

**Problema:** Geração de boletim muito demorada

**Soluções:**

1. **Usar modelo menor:**
   ```powershell
   docker exec boletim-ollama ollama pull gemma3:4b
   ```
   Configurar na interface: Configurações → Modelo LLM → gemma3:4b

2. **Aumentar recursos do Docker:**
   - Abrir Docker Desktop → Settings → Resources
   - Aumentar CPU (6 cores) e RAM (8GB)

3. **Verificar antivírus:**
   - Adicionar pasta do projeto à exclusões
   - Adicionar Docker à exclusões

### Frontend não carrega

**Problema:** Navegador fica carregando infinitamente

**Solução:**
```powershell
# Verificar containers
docker ps

# Se frontend não aparecer:
docker logs boletim-frontend

# Reiniciar apenas frontend
docker restart boletim-frontend

# Limpar cache do navegador: Ctrl+Shift+Delete
```

---

## 📊 Monitoramento

### Ver Recursos

```powershell
# Uso de CPU/RAM/Disco em tempo real
docker stats

# Espaço usado
docker system df -v
```

### Logs

```powershell
# Todos os containers
docker-compose logs

# Apenas API
docker logs boletim-api

# Últimas 50 linhas
docker logs boletim-api --tail 50

# Tempo real
docker logs -f boletim-api

# Com timestamp
docker logs -t boletim-api
```

### Task Manager

1. Abrir Task Manager (`Ctrl+Shift+Esc`)
2. Aba "Performance"
3. Ver uso de:
   - CPU
   - RAM
   - Disco
   - Rede

---

## 🔄 Atualizações

### Atualizar Sistema

```powershell
# Via Git
cd C:\Projetos\boletim-noticias
git pull

# Atualizar containers
.\comandos.bat update

# Ou manualmente:
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Atualizar Docker Desktop

1. Docker Desktop → Settings → Software updates
2. Clicar em "Download update"
3. Reiniciar Docker Desktop

---

## 💾 Backup e Restore

### Backup Automático

```powershell
.\comandos.bat backup
# Cria: backup_YYYYMMDD_HHMMSS.tar.gz
```

### Backup Manual

```powershell
# Backup de dados
Compress-Archive -Path data,audio -DestinationPath "backup-$(Get-Date -Format 'yyyyMMdd').zip"

# Backup de volume Ollama (modelos)
docker run --rm -v boletim-noticias_ollama_data:/data -v ${PWD}:/backup `
  ubuntu tar czf /backup/ollama-models.tar.gz /data
```

### Restore

```powershell
# Extrair backup
Expand-Archive backup_YYYYMMDD_HHMMSS.tar.gz

# Copiar arquivos
Copy-Item -Recurse backup_YYYYMMDD_HHMMSS\* .

# Reiniciar
.\comandos.bat restart
```

---

## 🚀 Performance

### Otimizações Docker Desktop

1. **Settings → Resources:**
   - CPUs: 6 (ou 75% dos cores)
   - Memory: 8GB (ou 50% da RAM total)
   - Swap: 2GB
   - Disk image size: 100GB

2. **Settings → General:**
   - ✅ "Use the WSL 2 based engine"
   - ✅ "Use Docker Compose V2"

3. **Settings → Docker Engine:**
   ```json
   {
     "builder": {
       "gc": {
         "enabled": true,
         "defaultKeepStorage": "20GB"
       }
     }
   }
   ```

### Limpeza Regular

```powershell
# Limpar imagens não usadas
docker image prune -a

# Limpar tudo (cuidado!)
docker system prune -a --volumes

# Ver espaço recuperado
docker system df
```

---

## 🔐 Segurança

### Acesso Local Apenas

Por padrão, sistema aceita conexões apenas de localhost.

### Acessar de Outra Máquina

Se quiser acessar de outro computador na rede:

```powershell
# Descobrir IP da máquina
ipconfig | Select-String "IPv4"
# Anote o IP (ex: 192.168.1.100)

# Abrir firewall
New-NetFirewallRule -DisplayName "Boletim Remote" `
  -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow

# Acessar de outro PC:
# http://192.168.1.100:3000
```

---

## 📱 Acessibilidade

### Leitores de Tela

**NVDA (Recomendado - Gratuito):**
1. Baixar: https://www.nvaccess.org/download/
2. Instalar e executar
3. NVDA inicia automaticamente

**JAWS (Pago):**
- Compatível, mas requer licença

### Configurar NVDA

1. Abrir NVDA
2. NVDA Menu → Preferences → Settings
3. Aba "Speech":
   - Rate: 50 (ajuste conforme preferência)
4. Aba "Keyboard":
   - ✅ "Speak typed characters"
   - ✅ "Speak typed words"

### Atalhos do Sistema

| Atalho | Ação |
|--------|------|
| `Ctrl+Enter` | Gerar boletim |
| `Ctrl+E` | Editar texto |
| `Ctrl+D` | Baixar áudio |
| `Alt+1` | Ir para Gerar |
| `Alt+2` | Ir para Histórico |
| `Alt+3` | Ir para Configurações |
| `Alt+4` | Ir para Ajuda |
| `Tab` | Próximo elemento |
| `Shift+Tab` | Elemento anterior |

---

## ✅ Checklist Pós-Instalação

- [ ] WSL 2 instalado e funcionando
- [ ] Docker Desktop rodando (ícone verde)
- [ ] Projeto extraído em `C:\Projetos\boletim-noticias`
- [ ] Containers iniciados (`.\comandos.bat start`)
- [ ] Modelo LLM baixado
- [ ] Frontend acessível (http://localhost:3000)
- [ ] API respondendo (http://localhost:8000/health)
- [ ] Geração de boletim funcionando
- [ ] Download de áudio OK
- [ ] NVDA instalado (se necessário)

---

## 🎓 Dicas Windows

1. **Adicionar ao PATH** (opcional):
   ```powershell
   # Adicionar pasta ao PATH para executar de qualquer lugar
   $env:Path += ";C:\Projetos\boletim-noticias"
   ```

2. **Iniciar com Windows** (opcional):
   - Pressione `Win+R`
   - Digite: `shell:startup`
   - Crie atalho para `comandos.bat start` nesta pasta

3. **Usar Windows Terminal** (recomendado):
   - Instalar via Microsoft Store
   - Melhor que PowerShell padrão
   - Suporta abas múltiplas

---

## 🆘 Suporte

- 📖 [README Principal](README.md)
- 🐧 [Guia Linux](LINUX.md)
- 💬 GitHub Issues
- 📧 Email de suporte

---

**Sistema pronto para uso em Windows!** 🎉

Para voltar ao [README principal](README.md)
