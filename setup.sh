#!/bin/bash

# ========================================
# Script de Setup - Sistema de Boletim de Notícias
# ========================================

set -e  # Exit on error

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Banner
echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════╗"
echo "║  Sistema de Boletim de Notícias - Setup       ║"
echo "║  Versão 1.0.0                                  ║"
echo "╚════════════════════════════════════════════════╝"
echo -e "${NC}"

# Função para print com cor
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}→ $1${NC}"
}

print_section() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

# ========================================
# 1. Verificar Dependências
# ========================================
print_section "Verificando Dependências"

# Docker
print_info "Verificando Docker..."
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    print_success "Docker encontrado: $DOCKER_VERSION"
else
    print_error "Docker não encontrado!"
    echo "Por favor, instale Docker:"
    echo "  https://docs.docker.com/get-docker/"
    exit 1
fi

# Docker Compose
print_info "Verificando Docker Compose..."
if command -v docker-compose &> /dev/null; then
    COMPOSE_VERSION=$(docker-compose --version)
    print_success "Docker Compose encontrado: $COMPOSE_VERSION"
else
    print_error "Docker Compose não encontrado!"
    echo "Por favor, instale Docker Compose:"
    echo "  https://docs.docker.com/compose/install/"
    exit 1
fi

# Verificar Docker está rodando
print_info "Verificando se Docker está rodando..."
if docker info &> /dev/null; then
    print_success "Docker está rodando"
else
    print_error "Docker não está rodando!"
    echo "Inicie o Docker e tente novamente"
    exit 1
fi

# ========================================
# 2. Criar Estrutura de Diretórios
# ========================================
print_section "Criando Estrutura de Diretórios"

mkdir -p data/boletins
mkdir -p data/config
mkdir -p audio/exports
mkdir -p backend/app/services
mkdir -p frontend/src/css
mkdir -p frontend/src/js

print_success "Diretórios criados"

# ========================================
# 3. Configurar Arquivo .env
# ========================================
print_section "Configurando Ambiente"

if [ ! -f .env ]; then
    print_info "Criando arquivo .env..."
    cp .env.example .env
    print_success "Arquivo .env criado"
    print_info "Edite .env se necessário para personalizar configurações"
else
    print_info "Arquivo .env já existe, mantendo configurações"
fi

# ========================================
# 4. Verificar Recursos do Sistema
# ========================================
print_section "Verificando Recursos do Sistema"

# RAM
if command -v free &> /dev/null; then
    TOTAL_RAM=$(free -g | awk '/^Mem:/{print $2}')
    print_info "RAM total: ${TOTAL_RAM}GB"
    if [ "$TOTAL_RAM" -lt 8 ]; then
        print_error "Aviso: Recomendado mínimo 8GB de RAM"
    else
        print_success "RAM adequada"
    fi
fi

# Disco
DISK_SPACE=$(df -h . | awk 'NR==2 {print $4}')
print_info "Espaço disponível: $DISK_SPACE"

# ========================================
# 5. Construir Containers
# ========================================
print_section "Construindo Containers Docker"

print_info "Isso pode levar alguns minutos..."
if docker-compose build; then
    print_success "Containers construídos com sucesso"
else
    print_error "Erro ao construir containers"
    exit 1
fi

# ========================================
# 6. Iniciar Serviços
# ========================================
print_section "Iniciando Serviços"

print_info "Iniciando containers..."
if docker-compose up -d; then
    print_success "Serviços iniciados"
else
    print_error "Erro ao iniciar serviços"
    exit 1
fi

# Aguardar containers ficarem prontos
print_info "Aguardando containers ficarem prontos..."
sleep 10

# Verificar status
print_info "Verificando status dos containers..."
docker-compose ps

# ========================================
# 7. Configurar Ollama
# ========================================
print_section "Configurando Ollama (LLM)"

print_info "Este passo pode levar vários minutos (download ~4GB)..."
read -p "Deseja baixar o modelo agora? (s/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Ss]$ ]]; then
    print_info "Baixando modelo llama3.2..."
    if docker-compose exec -T ollama ollama pull llama3.2; then
        print_success "Modelo baixado com sucesso"
    else
        print_error "Erro ao baixar modelo"
        print_info "Você pode tentar novamente depois com: make setup-ollama"
    fi
else
    print_info "Pulando download do modelo"
    print_info "Execute 'make setup-ollama' quando estiver pronto"
fi

# ========================================
# 8. Testar Instalação
# ========================================
print_section "Testando Instalação"

# Testar API
print_info "Testando API..."
sleep 5
if curl -s http://localhost:8000/health &> /dev/null; then
    print_success "API respondendo"
else
    print_error "API não está respondendo"
    print_info "Verifique logs com: make logs-api"
fi

# Testar Frontend
print_info "Testando Frontend..."
if curl -s http://localhost:3000 &> /dev/null; then
    print_success "Frontend acessível"
else
    print_error "Frontend não está acessível"
fi

# ========================================
# Conclusão
# ========================================
print_section "Instalação Concluída!"

echo ""
echo -e "${GREEN}Sistema instalado e rodando!${NC}"
echo ""
echo -e "${BLUE}Acesse o sistema:${NC}"
echo -e "  Frontend: ${YELLOW}http://localhost:3000${NC}"
echo -e "  API:      ${YELLOW}http://localhost:8000${NC}"
echo -e "  Docs:     ${YELLOW}http://localhost:8000/docs${NC}"
echo ""
echo -e "${BLUE}Comandos úteis:${NC}"
echo "  make help       - Ver todos os comandos"
echo "  make logs       - Ver logs"
echo "  make stop       - Parar serviços"
echo "  make restart    - Reiniciar serviços"
echo ""
echo -e "${YELLOW}Próximos passos:${NC}"
echo "  1. Se ainda não baixou o modelo: make setup-ollama"
echo "  2. Acesse http://localhost:3000 no navegador"
echo "  3. Configure e gere seu primeiro boletim!"
echo ""
echo -e "${GREEN}Aproveite!${NC}"
echo ""
