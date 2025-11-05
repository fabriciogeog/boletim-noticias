#!/bin/bash
# -----------------------------------------------
# Script de sincronização Git - por Fabricio
# Automatiza: add, commit, pull e push com segurança
# -----------------------------------------------

# Cores para mensagens
VERDE="\033[1;32m"
AMARELO="\033[1;33m"
VERMELHO="\033[1;31m"
AZUL="\033[1;34m"
RESET="\033[0m"

echo -e "${AZUL}🔍 Verificando repositório Git...${RESET}"

# Verifica se existe um repositório Git
if [ ! -d ".git" ]; then
    echo -e "${VERMELHO}❌ Esta pasta não é um repositório Git.${RESET}"
    exit 1
fi

# Mostra status atual
echo -e "${AMARELO}"
git status
echo -e "${RESET}"

# Adiciona tudo ao staging
echo -e "${AZUL}📦 Adicionando arquivos modificados...${RESET}"
git add .

# Pede mensagem de commit
echo -ne "${AMARELO}✏️  Digite a mensagem do commit (ou deixe em branco para usar padrão): ${RESET}"
read MENSAGEM

# Se o usuário não escrever nada, cria mensagem padrão com data/hora
if [ -z "$MENSAGEM" ]; then
    MENSAGEM="Atualização automática em $(date '+%d/%m/%Y %H:%M:%S')"
fi

# Faz o commit
git commit -m "$MENSAGEM"

# Atualiza o branch local antes de enviar
echo -e "${AZUL}⬇️  Atualizando branch local com o remoto...${RESET}"
git pull origin main --rebase

# Envia as alterações
echo -e "${AZUL}⬆️  Enviando alterações para o GitHub...${RESET}"
git push origin main

if [ $? -eq 0 ]; then
    echo -e "${VERDE}✅ Sincronização concluída com sucesso!${RESET}"
else
    echo -e "${VERMELHO}⚠️  Ocorreu um erro durante o push. Verifique o log acima.${RESET}"
fi
