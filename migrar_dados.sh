#!/bin/bash

# Nome do arquivo com a data de hoje
BACKUP_NAME="backup_boletim_$(date +%Y%m%d).tar.gz"

exportar() {
    echo "📦 Iniciando exportação de dados..."
    docker compose stop
    # Compacta as pastas de volumes e as chaves de API
    tar -czvf $BACKUP_NAME ./data ./audio .env docker-compose.yml
    docker compose start
    echo "✅ Backup criado com sucesso: $BACKUP_NAME"
}

importar() {
    echo "🚚 Iniciando importação..."
    if [ -f "$BACKUP_NAME" ]; then
        tar -xzvf $BACKUP_NAME
        docker compose up -d --build
        echo "✅ Sistema restaurado e atualizado!"
    else
        echo "❌ Arquivo de backup não encontrado."
    fi
}

case "$1" in
    exportar) exportar ;;
    importar) importar ;;
    *) echo "Use: ./migrar_dados.sh {exportar|importar}" ;;
esac
