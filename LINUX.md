# 🐧 Guia de Instalação - Linux

Sistema de Boletim de Notícias para Ubuntu, Debian, Fedora e outras distribuições.

---

## 📋 Requisitos

### Distribuições Suportadas
- Ubuntu 20.04+ / Debian 11+
- Fedora 35+
- Arch Linux
- Linux Mint 20+

### Requisitos de Sistema
- **RAM**: 8GB mínimo (16GB recomendado)
- **Disco**: 30GB livres
- **CPU**: 64-bit, 4+ cores
- **Kernel**: 5.0+

---

## 🚀 Instalação Completa

### Método 1: Script Automático (Recomendado)

```bash
# Baixar e executar
cd ~/Projetos  # ou onde preferir
git clone https://github.com/seu-usuario/boletim-noticias.git
cd boletim-noticias
chmod +x setup.sh
./setup.sh
```

### Método 2: Manual Passo a Passo

#### 1. Instalar Docker

**Ubuntu/Debian:**
```bash
# Remover versões antigas
sudo apt-get remove docker docker-engine docker.io containerd runc

# Instalar dependências
sudo apt-get update
sudo apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# Adicionar chave GPG oficial do Docker
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Configurar repositório
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Instalar Docker
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Adicionar usuário ao grupo docker
sudo usermod -aG docker $USER

# Reiniciar sessão (logout/login) ou executar:
newgrp docker
```

**Fedora:**
```bash
sudo dnf -y install dnf-plugins-core
sudo dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
newgrp docker
```

**Arch Linux:**
```bash
sudo pacman -S docker docker-compose
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
newgrp docker
```

#### 2. Verificar Instalação Docker

```bash
docker --version
docker-compose --version
docker run hello-world
```

#### 3. Clonar e Instalar Projeto

```bash
# Clonar repositório
git clone https://github.com/seu-usuario/boletim-noticias.git
cd boletim-noticias

# Instalar via Makefile
make install
```

---

## 🎮 Comandos do Sistema

### Makefile - Comandos Principais

```bash
make help           # Mostrar todos os comandos
make install        # Instalação inicial
make start          # Iniciar sistema
make stop           # Parar sistema
make restart        # Reiniciar
make logs           # Ver logs em tempo real
make logs-api       # Logs apenas da API
make logs-ollama    # Logs do Ollama
make status         # Status dos containers
```

### Gerenciamento de Modelos LLM

```bash
# Listar modelos instalados
make ollama-list

# Baixar modelo padrão (llama3:8b)
make setup-ollama

# Baixar modelo específico
make ollama-pull MODEL=gemma3:4b

# Outros modelos disponíveis:
make ollama-pull MODEL=mistral:7b
make ollama-pull MODEL=gemma3:27b
```

### Manutenção

```bash
make clean          # Limpar containers e volumes
make backup         # Fazer backup
make update         # Atualizar sistema
make monitor        # Monitorar recursos
```

### Debug

```bash
make shell-api      # Terminal no container API
make shell-ollama   # Terminal no container Ollama
make test-api       # Testar API
make test-feeds     # Testar coleta de notícias
```

---

## 🔧 Configuração Avançada

### GPU NVIDIA (Opcional)

Se você tem GPU NVIDIA e quer acelerar o Ollama:

1. Instalar NVIDIA Container Toolkit:
```bash
# Ubuntu/Debian
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list
sudo apt-get update
sudo apt-get install -y nvidia-docker2
sudo systemctl restart docker
```

2. Editar `docker-compose.yml` e descomentar:
```yaml
ollama:
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
```

3. Reiniciar:
```bash
make restart
```

### Personalizar Portas

Edite `docker-compose.yml`:
```yaml
services:
  frontend:
    ports:
      - "3001:3000"  # Mudar porta externa
  api:
    ports:
      - "8001:8000"
```

### Configurar Firewall

```bash
# UFW (Ubuntu)
sudo ufw allow 3000/tcp
sudo ufw allow 8000/tcp

# Firewalld (Fedora)
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --permanent --add-port=8000/tcp
sudo firewall-cmd --reload
```

---

## 🐛 Solução de Problemas

### Docker: permission denied

```bash
# Adicionar usuário ao grupo docker
sudo usermod -aG docker $USER

# Reiniciar sessão
logout
# Faça login novamente
```

### Porta em uso

```bash
# Ver o que está usando a porta
sudo lsof -i :3000
sudo lsof -i :8000

# Matar processo
sudo kill -9 PID
```

### Containers não iniciam

```bash
# Ver logs detalhados
make logs

# Verificar se Docker está rodando
sudo systemctl status docker

# Reiniciar Docker
sudo systemctl restart docker

# Rebuild completo
make clean
make install
```

### Ollama sem modelos

```bash
# Entrar no container
docker exec -it boletim-ollama /bin/sh

# Listar modelos
ollama list

# Baixar modelo
ollama pull llama3:8b

# Sair
exit
```

### Sem espaço em disco

```bash
# Ver uso de disco
df -h

# Limpar Docker
docker system prune -a --volumes

# Remover imagens não usadas
docker image prune -a
```

### API lenta

```bash
# Verificar recursos
make monitor

# Ver modelo sendo usado
docker exec boletim-ollama ollama list

# Trocar para modelo menor
docker exec boletim-ollama ollama pull gemma3:4b

# Configurar no sistema (Configurações > Modelo LLM)
```

---

## 📊 Monitoramento

### Ver Uso de Recursos

```bash
# Tempo real
make monitor

# Ou manualmente
docker stats

# Disco usado por volumes
docker system df -v
```

### Logs Estruturados

```bash
# Últimas 50 linhas
docker logs boletim-api --tail 50

# Seguir em tempo real
docker logs -f boletim-api

# Filtrar erros
docker logs boletim-api 2>&1 | grep -i error

# Com timestamp
docker logs -t boletim-api
```

---

## 🔄 Atualizações

### Atualizar Sistema

```bash
cd ~/Projetos/boletim-noticias
git pull
make update
```

### Atualizar Docker

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get upgrade docker-ce docker-ce-cli containerd.io

# Fedora
sudo dnf upgrade docker-ce docker-ce-cli containerd.io
```

---

## 💾 Backup e Restore

### Backup Automático

```bash
make backup
# Cria: backup_YYYYMMDD_HHMMSS.tar.gz
```

### Backup Manual

```bash
# Backup de dados e áudios
tar -czf backup-$(date +%Y%m%d).tar.gz data/ audio/

# Backup de volume Ollama (modelos)
docker run --rm -v boletim-noticias_ollama_data:/data -v $(pwd):/backup \
  ubuntu tar czf /backup/ollama-models.tar.gz /data
```

### Restore

```bash
# Extrair backup
tar -xzf backup_YYYYMMDD_HHMMSS.tar.gz

# Reiniciar sistema
make restart
```

---

## 🚀 Performance

### Otimizações

1. **Usar SSD** para volumes Docker
2. **Aumentar RAM** se possível (16GB ideal)
3. **Modelo menor** para máquinas modestas:
   ```bash
   docker exec boletim-ollama ollama pull gemma3:4b
   ```
4. **Limpar regularmente**:
   ```bash
   docker system prune -f
   ```

### Benchmarks

| Modelo | Tamanho | RAM Usada | Tempo Geração |
|--------|---------|-----------|---------------|
| gemma3:4b | 3.3GB | ~5GB | ~15s |
| llama3:8b | 4.7GB | ~7GB | ~25s |
| mistral:7b | 4.4GB | ~6GB | ~20s |

---

## 🔐 Segurança

### Firewall

```bash
# Permitir apenas localhost
sudo ufw default deny incoming
sudo ufw allow from 127.0.0.1 to any port 3000
sudo ufw allow from 127.0.0.1 to any port 8000
sudo ufw enable
```

### Acessar de Outra Máquina

Se quiser acessar de outra máquina na rede:

```bash
# Descobrir IP
ip addr show | grep inet

# Permitir no firewall
sudo ufw allow from 192.168.1.0/24 to any port 3000

# Acessar de outro computador:
# http://IP_DA_MAQUINA:3000
```

---

## 📱 Acesso Remoto

### Via SSH Tunnel (Seguro)

De outra máquina:
```bash
ssh -L 3000:localhost:3000 usuario@servidor
# Acesse: http://localhost:3000 no navegador
```

### Via HTTPS (Produção)

Use Nginx reverse proxy com Let's Encrypt:
```bash
sudo apt install nginx certbot python3-certbot-nginx
# Configurar domínio e SSL
```

---

## 🎓 Dicas

1. **Alias úteis** (adicione ao `~/.bashrc`):
   ```bash
   alias boletim-start='cd ~/Projetos/boletim-noticias && make start'
   alias boletim-stop='cd ~/Projetos/boletim-noticias && make stop'
   alias boletim-logs='cd ~/Projetos/boletim-noticias && make logs'
   ```

2. **Autostart** (systemd):
   ```bash
   # Criar serviço
   sudo nano /etc/systemd/system/boletim.service
   ```
   ```ini
   [Unit]
   Description=Boletim de Noticias
   After=docker.service
   Requires=docker.service

   [Service]
   Type=oneshot
   RemainAfterExit=yes
   WorkingDirectory=/home/USER/Projetos/boletim-noticias
   ExecStart=/usr/bin/make start
   ExecStop=/usr/bin/make stop

   [Install]
   WantedBy=multi-user.target
   ```
   ```bash
   sudo systemctl enable boletim
   sudo systemctl start boletim
   ```

---

## ✅ Checklist Pós-Instalação

- [ ] Docker instalado e rodando
- [ ] Projeto clonado
- [ ] Containers iniciados (`make start`)
- [ ] Modelo LLM baixado (`make setup-ollama`)
- [ ] Frontend acessível (http://localhost:3000)
- [ ] API respondendo (http://localhost:8000/health)
- [ ] Geração de boletim funcionando
- [ ] Download de áudio OK
- [ ] Backup configurado

---

**Sistema pronto para uso em produção!** 🎉

Para voltar ao [README principal](README.md)
