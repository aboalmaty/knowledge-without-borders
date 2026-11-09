@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (echo Node.js LTS is required. & pause & exit /b 1)
where npm >nul 2>nul
if errorlevel 1 (echo npm is required. & pause & exit /b 1)
where cargo >nul 2>nul
if errorlevel 1 (echo Rust/Cargo is required for the desktop app. See README_AR.md. & pause & exit /b 1)
if not exist node_modules (
  echo Installing JavaScript dependencies...
  call npm install
  if errorlevel 1 (pause & exit /b 1)
)
call npm run tauri build
if errorlevel 1 (echo Build failed. See the error output and README_AR.md. & pause & exit /b 1)
echo Build completed. Check src-tauri\target\release\bundle\
pause
