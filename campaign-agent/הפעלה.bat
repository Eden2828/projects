@echo off
chcp 65001 >nul
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  echo מתקין בפעם הראשונה...
  call "התקנה-פעם-ראשונה.bat"
)

echo =====================================================
echo   Campaign Agent מופעל...
echo   במחשב הזה:        http://localhost:8000
echo   (הקישור לקמפיינרים יופיע בעוד רגע למטה)
echo   לעצירה: סגור את החלון הזה.
echo =====================================================
echo.

start "" /b powershell -WindowStyle Hidden -Command "Start-Sleep 4; Start-Process 'http://localhost:8000'"
".venv\Scripts\python.exe" -m uvicorn backend.main:app --host 0.0.0.0 --port 8000

pause
