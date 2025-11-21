#!/bin/bash
# -----------------------------------------------
# Script de sincronização Git - Blindado
# -----------------------------------------------

# Cores
VERDE="\033[1;32m"
AMARELO="\033[1;33m"
VERMELHO="\033[1;31m"
AZUL="\033[1;34m"
RESET="\033[0m"

echo -e "${AZUL}🔍 Verificando repositório e segurança...${RESET}"

# 1. Verifica se é um repo Git
if [ ! -d ".git" ]; then
    echo -e "${VERMELHO}❌ Erro: Esta pasta não é um repositório Git.${RESET}"
    exit 1
fi

# 2. TRAVA DE SEGURANÇA (NOVO): Verifica se o .env está protegido
if [ -f ".env" ]; then
    # Pergunta ao Git: "Você está ignorando o arquivo .env?"
    IGNORE_CHECK=$(git check-ignore .env)
    
    if [ -z "$IGNORE_CHECK" ]; then
        echo -e "${VERMELHO}🚨 PERIGO: O arquivo .env NÃO está no .gitignore!${RESET}"
        echo -e "${AMARELO}O script foi abortado para evitar vazamento de senhas.${RESET}"
        echo "Adicione .env ao arquivo .gitignore antes de continuar."
        exit 1
    else
        echo -e "${VERDE}🛡️  Segurança OK: Arquivo .env está protegido/ignorado.${RESET}"
    fi
fi

# Mostra status
echo -e "${AMARELO}"
git status
echo -e "${RESET}"

# Adiciona arquivos
echo -e "${AZUL}📦 Adicionando arquivos modificados...${RESET}"
git add .

# Mensagem de commit
echo -ne "${AMARELO}✏️  Mensagem do commit (Enter para padrão): ${RESET}"
read MENSAGEM

if [ -z "$MENSAGEM" ]; then
    MENSAGEM="Atualização automática em $(date '+%d/%m/%Y %H:%M:%S')"
fi

# Commit
git commit -m "$MENSAGEM"

# Pull com Rebase (Traz mudanças da nuvem sem criar commits de merge sujos)
echo -e "${AZUL}⬇️  Sincronizando com o remoto (Pull)...${RESET}"
git pull origin main --rebase

# Push
echo -e "${AZUL}⬆️  Enviando para o GitHub...${RESET}"
git push origin main

if [ $? -eq 0 ]; then
    echo -e "${VERDE}✅ Sucesso! Projeto atualizado.${RESET}"
else
    echo -e "${VERMELHO}⚠️  Erro no envio. Verifique se há conflitos ou bloqueios.${RESET}"
fi
