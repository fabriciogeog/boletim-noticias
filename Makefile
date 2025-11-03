.PHONY: help install start stop restart logs clean test setup-ollama

# Cores para output
GREEN  := $(shell tput -Txterm setaf 2)
YELLOW := $(shell tput -Txterm setaf 3)
WHITE  := $(shell tput -Txterm setaf 7)
RESET  := $(shell tput -Txterm sgr0)

help: ## Mostra este menu de ajuda
	@echo ''
	@echo 'Uso:'
	@echo '  ${YELLOW}make${RESET} ${GREEN}<target>${RESET}'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} { \
		if (/^[a-zA-Z_-]+:.*?##.*$$/) {printf "  ${YELLOW}%-20s${GREEN}%s${RESET}\n", $$1, $$2} \
	}' $(MAKEFILE_LIST)

install: ## Instala e configura o sistema completo
	@echo "${GREEN}Instalando sistema de Boletim de Notícias...${RESET}"
	@echo "${YELLOW}Verificando Docker...${RESET}"
	@docker --version || (echo "${RED}Docker não encontrado! Instale Docker primeiro.${RESET}" && exit 1)
	@docker-compose --version || (echo "${RED}Docker Compose não encontrado!${RESET}" && exit 1)
	@echo "${GREEN}✓ Docker OK${RESET}"
	@echo "${YELLOW}Criando estrutura de diretórios...${RESET}"
	@mkdir -p data/boletins data/config audio/exports
	@echo "${GREEN}✓ Estrutura criada${RESET}"
	@echo "${YELLOW}Construindo containers...${RESET}"
	@docker-compose build
	@echo "${GREEN}✓ Containers construídos${RESET}"
	@echo "${GREEN}Instalação concluída!${RESET}"
	@echo "${YELLOW}Execute 'make start' para iniciar o sistema${RESET}"

start: ## Inicia todos os serviços
	@echo "${GREEN}Iniciando serviços...${RESET}"
	@docker-compose up -d
	@echo "${GREEN}✓ Serviços iniciados${RESET}"
	@echo "${YELLOW}Aguardando containers ficarem prontos...${RESET}"
	@sleep 5
	@$(MAKE) status
	@echo ""
	@echo "${GREEN}Sistema disponível em:${RESET}"
	@echo "  Frontend: ${YELLOW}http://localhost:3000${RESET}"
	@echo "  API:      ${YELLOW}http://localhost:8000${RESET}"
	@echo "  Docs API: ${YELLOW}http://localhost:8000/docs${RESET}"

stop: ## Para todos os serviços
	@echo "${YELLOW}Parando serviços...${RESET}"
	@docker-compose down
	@echo "${GREEN}✓ Serviços parados${RESET}"

restart: ## Reinicia todos os serviços
	@echo "${YELLOW}Reiniciando serviços...${RESET}"
	@docker-compose restart
	@echo "${GREEN}✓ Serviços reiniciados${RESET}"

logs: ## Mostra logs de todos os serviços
	@docker-compose logs -f

logs-api: ## Mostra logs apenas da API
	@docker-compose logs -f api

status: ## Mostra status dos containers
	@echo "${GREEN}Status dos containers:${RESET}"
	@docker-compose ps

setup-ollama: ## Configura e baixa modelo do Ollama
	@echo "${YELLOW}Verificando Ollama local...${RESET}"
	@ollama list || (echo "${RED}Ollama não encontrado! Instale primeiro.${RESET}" && exit 1)
	@echo "${YELLOW}Baixando modelo llama3.2 para Ollama local...${RESET}"
	@ollama pull llama3.2
	@echo "${GREEN}✓ Modelo baixado${RESET}"
	@echo "${YELLOW}Testando modelo...${RESET}"
	@ollama run llama3.2 "Olá, diga apenas 'OK' se estiver funcionando"
	@echo "${GREEN}✓ Ollama configurado${RESET}"

test-api: ## Testa conectividade com API
	@echo "${YELLOW}Testando API...${RESET}"
	@curl -s http://localhost:8000/health | python3 -m json.tool || echo "${RED}API não respondeu${RESET}"

test-feeds: ## Testa coleta de feeds RSS
	@echo "${YELLOW}Testando coleta de notícias...${RESET}"
	@curl -s -X POST http://localhost:8000/api/collect-news \
		-H "Content-Type: application/json" \
		-d '{"categories": ["geral"], "num_articles": 3}' | python3 -m json.tool

clean: ## Remove containers, volumes e arquivos temporários
	@echo "${YELLOW}Removendo containers e volumes...${RESET}"
	@docker-compose down -v
	@echo "${YELLOW}Limpando arquivos temporários...${RESET}"
	@find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	@find . -type f -name "*.pyc" -delete 2>/dev/null || true
	@echo "${GREEN}✓ Limpeza concluída${RESET}"

reset: clean install ## Reset completo do sistema
	@echo "${GREEN}Sistema resetado com sucesso!${RESET}"

backup: ## Faz backup dos dados
	@echo "${YELLOW}Criando backup...${RESET}"
	@tar -czf backup_$(shell date +%Y%m%d_%H%M%S).tar.gz data/ audio/
	@echo "${GREEN}✓ Backup criado${RESET}"

update: ## Atualiza containers e rebuild
	@echo "${YELLOW}Atualizando sistema...${RESET}"
	@git pull
	@docker-compose down
	@docker-compose build --no-cache
	@docker-compose up -d
	@echo "${GREEN}✓ Sistema atualizado${RESET}"

shell-api: ## Abre shell no container da API
	@docker-compose exec api /bin/bash

shell-ollama: ## Abre shell no container do Ollama
	@docker-compose exec ollama /bin/bash

dev: ## Modo desenvolvimento (com hot reload)
	@echo "${GREEN}Iniciando em modo desenvolvimento...${RESET}"
	@docker-compose up

prod: ## Modo produção
	@echo "${GREEN}Iniciando em modo produção...${RESET}"
	@docker-compose up -d

monitor: ## Monitora uso de recursos
	@docker stats boletim-api boletim-frontend
