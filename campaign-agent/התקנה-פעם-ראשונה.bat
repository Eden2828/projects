@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo =====================================================
echo   Campaign Agent - התקנה (פעם אחת בלבד)
echo =====================================================
echo.

set "PY="
if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" set "PY=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
if "%PY%"=="" ( py -3 --version >nul 2>nul && set "PY=py -3" )

if "%PY%"=="" (
  echo [!] Python לא נמצא במחשב.
  echo     התקן Python 3.12 מהקישור הבא, וסמן "Add Python to PATH":
  echo     https://www.python.org/downloads/
  echo     אחר כך הרץ שוב את הקובץ הזה.
  echo.
  pause
  exit /b 1
)

echo יוצר סביבה...
%PY% -m venv .venv
echo מתקין רכיבים (יכול לקחת כמה דקות)...
".venv\Scripts\python.exe" -m pip install --quiet --upgrade pip
".venv\Scripts\python.exe" -m pip install --quiet -r requirements.txt

echo.
echo =====================================================
echo   ההתקנה הסתיימה!
echo   עכשיו לחץ פעמיים על "הפעלה.bat" כדי להתחיל.
echo =====================================================
echo.
pause
