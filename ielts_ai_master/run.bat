@echo off
title IELTS AI Master - Shaxsiy IELTS AI Murabbiyi
echo ====================================================
echo    IELTS AI MASTER - Personal AI Coach (v2.0)
echo ====================================================
echo.
echo Kompyuterda ochish: http://127.0.0.1:8000
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    echo Mobil telefonda ochish (Wi-Fi orqali): http:%%a:8000
)
echo.
echo Brauzer ochilmoqda...
start http://127.0.0.1:8000

"C:\Users\user\AppData\Local\Python\bin\python.exe" -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload
pause
