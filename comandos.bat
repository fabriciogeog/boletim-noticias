@echo off
REM ========================================
REM Comandos do Sistema - Windows
REM (Usando Ollama no Docker)
REM ========================================

if "%1"=="" goto help
if "%1"=="start" goto start
if "%1"=="stop" goto stop
if "%1"=="restart" goto restart
if "%1"=="logs" goto logs
if "%1"=="status" goto status
if "%1"=="clean" goto clean
if "%1"=="update" goto update
if "%1"=="backup" goto backup
if "%1"=="ollama" goto ollama
goto help

:start
echo Iniciando sistema...
docker-compose -f docker-compose.windows.yml up -d
echo Aguardando containers ficarem prontos...
timeout /t 10 /nobreak >nul
echo.
echo [OK] Sistema iniciado!
echo.
call :status
echo.
echo Sistema disponivel em:
echo   Frontend: http://localhost:3000
echo   API:      http://localhost:8000
echo   Ollama:   http://localhost:11434
goto end

:ollama
echo Gerenciamento do Ollama:
echo.
echo Modelos instalados:
docker exec boletim-ollama ollama list
echo.
echo Para baixar novo modelo:
echo   docker exec boletim-ollama ollama pull NOME_DO_MODELO
echo.
echo Exemplo:
echo   docker exec boletim-ollama ollama pull llama3:8b
goto end

:stop
echo Parando sistema...
docker-compose -f docker-compose.windows.yml down
echo [OK] Sistema parado
goto end

:restart
echo Reiniciando sistema...
docker-compose -f docker-compose.windows.yml restart
echo [OK] Sistema reiniciado
goto end

:logs
echo Mostrando logs (Ctrl+C para sair)...
docker-compose -f docker-compose.windows.yml logs -f
goto end

:status
echo Status dos containers:
docker-compose -f docker-compose.windows.yml ps
goto end

:clean
echo Limpando containers e volumes...
docker-compose -f docker-compose.windows.yml down -v
echo Limpando arquivos temporarios...
if exist "audio\exports\*" del /q audio\exports\*
echo [OK] Limpeza concluida
goto end

:update
echo Atualizando sistema...
docker-compose -f docker-compose.windows.yml down
docker-compose -f docker-compose.windows.yml build --no-cache
docker-compose -f docker-compose.windows.yml up -d
echo [OK] Sistema atualizado
goto end

:backup
echo Criando backup...
set timestamp=%date:~-4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set timestamp=%timestamp: =0%
tar -czf backup_%timestamp%.tar.gz data audio
echo [OK] Backup criado: backup_%timestamp%.tar.gz
goto end

:help
echo.
echo Comandos disponiveis:
echo.
echo   comandos.bat start     - Iniciar sistema
echo   comandos.bat stop      - Parar sistema
echo   comandos.bat restart   - Reiniciar sistema
echo   comandos.bat logs      - Ver logs em tempo real
echo   comandos.bat status    - Ver status dos containers
echo   comandos.bat ollama    - Gerenciar modelos Ollama
echo   comandos.bat clean     - Limpar containers e volumes
echo   comandos.bat update    - Atualizar sistema
echo   comandos.bat backup    - Fazer backup dos dados
echo.
goto end

:end
