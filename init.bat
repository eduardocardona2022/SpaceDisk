@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title SpaceDisk

echo.
echo   SpaceDisk - Analizador de espacio en disco
echo   ------------------------------------------
echo.

rem Si ya hay una instancia saludable en el puerto 3001, solo abrir el navegador.
powershell -NoProfile -NonInteractive -Command "try { $r = Invoke-RestMethod -TimeoutSec 2 'http://127.0.0.1:3001/api/health'; if ($r.ok -eq $true) { exit 0 } } catch { }; exit 1" >nul 2>&1
if not errorlevel 1 (
  echo SpaceDisk ya esta en ejecucion.
  if not defined SPACEDISK_NO_OPEN (
    echo Abriendo el navegador...
    start "" "http://127.0.0.1:3001"
  )
  exit /b 0
)

where node >nul 2>&1
if errorlevel 1 goto no_node
where npm >nul 2>&1
if errorlevel 1 goto no_node

set "NODE_MAJOR="
for /f "delims=" %%V in ('node -p "process.versions.node.split('.')[0]"') do set "NODE_MAJOR=%%V"
if not defined NODE_MAJOR goto no_node
if %NODE_MAJOR% LSS 26 (
  echo Node.js 26 LTS es necesario. Version detectada: %NODE_MAJOR%.
  goto no_node
)

if not exist "node_modules" (
  echo Instalando dependencias...
  call npm install
  if errorlevel 1 goto error
)

echo Compilando la aplicacion...
call npm run build
if errorlevel 1 goto error

if not exist "dist\server.cjs" goto error

rem Buscar un puerto libre desde 3001.
set "APP_PORT=3001"
for /f "delims=" %%P in ('powershell -NoProfile -NonInteractive -Command "$p=3001; while ($p -lt 3020 -and (Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue)) { $p++ }; $p"') do set "APP_PORT=%%P"

echo Iniciando SpaceDisk en el puerto %APP_PORT%...
echo El navegador se abrira automaticamente.
echo Para detener la aplicacion, cierra la ventana "SpaceDisk Server".
echo.

set "SPACEDISK_OPEN=1"
set "PORT=%APP_PORT%"
start "SpaceDisk Server" cmd /k "title SpaceDisk Server && node dist\server.cjs"
exit /b 0

:no_node
if exist "release\SpaceDisk.exe" (
  echo Node.js 26 LTS no esta disponible. Iniciando el ejecutable portable...
  start "" "release\SpaceDisk.exe"
  exit /b 0
)
echo.
echo No se encontro Node.js 26 LTS ni el ejecutable release\SpaceDisk.exe.
echo Instala Node.js desde https://nodejs.org/ y vuelve a ejecutar init.bat.
pause
exit /b 1

:error
echo.
echo No se pudo preparar SpaceDisk.
echo Revisa los mensajes anteriores.
pause
exit /b 1
