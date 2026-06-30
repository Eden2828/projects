@echo off
chcp 65001 >nul
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  echo First-time install...
  call "%~dp0setup.bat"
)

echo =====================================================
echo   Campaign Agent is running...
echo   This computer:   http://localhost:8000
echo   (network link for campaigners appears below)
echo   To stop: close this window.
echo =====================================================
echo.

start "" /b powershell -WindowStyle Hidden -Command "Start-Sleep 4; Start-Process 'http://localhost:8000'"
".venv\Scripts\python.exe" -m uvicorn backend.main:app --host 0.0.0.0 --port 8000

pause
