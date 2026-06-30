@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo =====================================================
echo   Campaign Agent - one-time setup
echo =====================================================
echo.

set "PY="
if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" set "PY=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
if "%PY%"=="" ( py -3 --version >nul 2>nul && set "PY=py -3" )

if "%PY%"=="" (
  echo [!] Python was not found.
  echo     Install Python 3.12 and tick "Add Python to PATH":
  echo     https://www.python.org/downloads/
  echo     Then run this file again.
  echo.
  pause
  exit /b 1
)

echo Creating environment...
%PY% -m venv .venv
echo Installing components (may take a few minutes)...
".venv\Scripts\python.exe" -m pip install --quiet --upgrade pip
".venv\Scripts\python.exe" -m pip install --quiet -r requirements.txt

echo.
echo =====================================================
echo   Setup complete! Now double-click "start.bat".
echo =====================================================
echo.
pause
