@echo off
chcp 65001 >nul 2>&1
title Anduril - Agent Task Manager Control
color 0A
set "ANDURIL_DIR=e:\OneDrive\ortho-app\tools\Anduril"
set "PORT=3000"

:MENU
cls
echo.
echo  ======================================
echo       Anduril - Agent Task Manager
echo  ======================================
echo.
echo   [1]  Start Server
echo   [2]  Stop Server
echo   [3]  Open in Browser
echo   [4]  Status
echo   [0]  Exit
echo.
echo   * Server runs in the background (no window).
echo     You can close this menu safely.
echo.
echo     Made by AirZone
echo.
set "choice="
set /p choice="  Choose [0-4]: "

if "%choice%"=="1" goto START
if "%choice%"=="2" goto STOP
if "%choice%"=="3" goto BROWSER
if "%choice%"=="4" goto STATUS
if "%choice%"=="0" goto EXIT
goto MENU

:EXIT
echo.
echo  Bye!
ping -n 2 127.0.0.1 >nul
exit

:START
echo.
echo  Stopping old instance...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT%.*LISTEN" 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 2 /nobreak >nul
echo  Starting server on port %PORT%...
powershell -Command "Start-Process -FilePath 'node' -ArgumentList 'server.js' -WorkingDirectory '%ANDURIL_DIR%' -WindowStyle Hidden -RedirectStandardOutput '%ANDURIL_DIR%\server.log' -RedirectStandardError '%ANDURIL_DIR%\server.err.log'"
timeout /t 3 /nobreak >nul
node -e "require('http').get('http://localhost:%PORT%/', r => {console.log('  OK - Status: ' + r.statusCode); process.exit(0)}).on('error', e => {console.log('  FAIL: ' + e.message); process.exit(1)})"
echo.
echo  Opening browser...
start http://localhost:%PORT%
echo.
pause
goto MENU

:STOP
echo.
echo  Stopping server...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT%.*LISTEN" 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
    echo  Stopped PID %%a
)
echo  Done.
echo.
pause
goto MENU

:BROWSER
echo.
echo  Opening browser...
start http://localhost:%PORT%
echo.
pause
goto MENU

:STATUS
echo.
echo  === Server ===
node -e "require('http').get('http://localhost:%PORT%/', r => {console.log('  Server: RUNNING (port %PORT%)');process.exit(0)}).on('error', () => {console.log('  Server: NOT RUNNING');process.exit(0)})" 2>nul
echo.
pause
goto MENU
