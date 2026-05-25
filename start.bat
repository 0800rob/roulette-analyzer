@echo off
REM ===================================================================
REM Roulette Analyzer — abre backend e frontend em duas janelas
REM Use Ctrl+C em cada janela para parar.
REM ===================================================================

set PROJECT_ROOT=%~dp0

start "Roulette Backend" cmd /k "cd /d %PROJECT_ROOT%backend && python -m uvicorn app.main:app --reload --port 8000"

REM espera o backend subir antes do frontend
timeout /t 3 /nobreak >nul

start "Roulette Frontend" cmd /k "cd /d %PROJECT_ROOT%frontend && npm run dev"

echo.
echo ============================================================
echo  Backend  -> http://localhost:8000
echo  Frontend -> http://localhost:5173
echo.
echo  Para fechar: Ctrl+C em cada janela aberta.
echo ============================================================
echo.
pause
