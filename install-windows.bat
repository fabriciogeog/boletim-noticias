@echo off
REM ========================================
REM Script de Instalação - Windows 10/11
REM Sistema de Boletim de Notícias
REM ========================================

echo.
echo ========================================
echo   Sistema de Boletim de Noticias
echo   Instalacao Automatica - Windows
echo ========================================
echo.

REM Verificar se está executando como Administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERRO] Execute como Administrador!
    echo Clique com botao direito e selecione "Executar como administrador"
    pause
    exit /b 1
)

REM ========================================
REM 1. Verificar Docker
REM ========================================
echo [1/6] Verificando Docker...
docker --version >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERRO] Docker nao encontrado!
    echo.
    echo Por favor, instale Docker Desktop:
    echo   https://www.docker.com/products/docker-desktop/
    echo.
    pause
    exit /b 1
)
echo [OK] Docker encontrado

REM Verificar se Docker está rodando
docker ps >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERRO] Docker nao esta rodando!
    echo Inicie o Docker Desktop e tente novamente.
    pause
    exit /b 1
)
echo [OK] Docker esta rodando

REM ========================================
REM 2. Verificar Ollama
REM ========================================
echo.
echo [2/6] Ollama sera instalado no Docker
echo Nao e necessario instalar Ollama no Windows!
echo.

REM ========================================
REM 3. Criar estrutura de diretorios
REM ========================================
echo.
echo [3/6] Criando estrutura de diretorios...
if not exist "data\boletins" mkdir data\boletins
if not exist "data\config" mkdir data\config
if not exist "audio\exports" mkdir audio\exports
echo [OK] Diretorios criados

REM ========================================
REM 4. Build dos containers
REM ========================================
echo.
echo [4/6] Construindo containers Docker...
echo Isso pode levar alguns minutos...
docker-compose -f docker-compose.windows.yml build
if %errorLevel% neq 0 (
    echo [ERRO] Falha ao construir containers
    pause
    exit /b 1
)
echo [OK] Containers construidos

REM ========================================
REM 5. Iniciar sistema
REM ========================================
echo.
echo [5/6] Iniciando sistema...
docker-compose -f docker-compose.windows.yml up -d
if %errorLevel% neq 0 (
    echo [ERRO] Falha ao iniciar containers
    pause
    exit /b 1
)
echo [OK] Sistema iniciado

REM Aguardar containers ficarem prontos
echo Aguardando containers ficarem prontos...
timeout /t 10 /nobreak >nul

REM ========================================
REM 6. Verificar status
REM ========================================
echo.
echo [6/6] Verificando status...
docker-compose -f docker-compose.windows.yml ps

REM ========================================
REM Conclusao
REM ========================================
echo.
echo ========================================
echo   Instalacao Concluida!
echo ========================================
echo.
echo Sistema disponivel em:
echo   Frontend: http://localhost:3000
echo   API:      http://localhost:8000
echo   Docs:     http://localhost:8000/docs
echo.
echo Comandos uteis:
echo   comandos.bat start    - Iniciar sistema
echo   comandos.bat stop     - Parar sistema
echo   comandos.bat logs     - Ver logs
echo   comandos.bat status   - Ver status
echo.
echo Deseja abrir o sistema no navegador? (S/N)
set /p abrir=
if /i "%abrir%"=="S" start http://localhost:3000
echo.
echo Instalacao finalizada!
pause
