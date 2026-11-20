@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title SpaceDisk - Limpieza

echo.
echo   SpaceDisk - Limpieza
echo   --------------------
echo.

rem 1. Detener la aplicacion si esta en ejecucion (ventana, procesos node y puertos 3001-3019).
echo Comprobando si SpaceDisk esta en ejecucion...
taskkill /FI "WINDOWTITLE eq SpaceDisk Server*" /T /F >nul 2>&1
taskkill /IM SpaceDisk.exe /T /F >nul 2>&1
powershell -NoProfile -NonInteractive -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -like '*server.cjs*' -or $_.CommandLine -like '*server/src/index.ts*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Get-NetTCPConnection -State Listen -LocalPort (3001..3019) -ErrorAction SilentlyContinue | ForEach-Object { $p = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue; if ($p -and ($p.ProcessName -eq 'node' -or $p.ProcessName -eq 'SpaceDisk')) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue } }" >nul 2>&1
timeout /t 2 /nobreak >nul
echo SpaceDisk detenido si estaba en ejecucion.
echo.

rem 2. Eliminar carpetas que no son necesarias (se regeneran con init.bat).
if exist "dist" (
  echo Eliminando dist\ ...
  rmdir /s /q "dist"
  if exist "dist" (echo   No se pudo eliminar dist\) else (echo   OK)
)
if exist "node_modules" (
  echo Eliminando node_modules\ ...
  rmdir /s /q "node_modules"
  if exist "node_modules" (echo   No se pudo eliminar node_modules\) else (echo   OK)
)

echo.
echo Limpieza terminada.
pause
exit /b 0
