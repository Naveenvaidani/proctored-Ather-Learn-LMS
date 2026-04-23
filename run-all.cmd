@echo off
setlocal

cd /d "%~dp0"

where pnpm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] pnpm is not installed or not in PATH.
  echo Install pnpm first: npm install -g pnpm
  exit /b 1
)

if not exist "node_modules" (
  echo [INFO] Installing dependencies...
  call pnpm install
  if errorlevel 1 (
    echo [ERROR] Dependency installation failed.
    exit /b 1
  )
)

if exist "backend\.env" (
  findstr /C:"<remaining URI>" "backend\.env" >nul 2>&1
  if not errorlevel 1 (
    echo [ERROR] backend\.env has a placeholder DB_URL.
    echo [ERROR] Set DB_URL to a real MongoDB connection string before starting.
    echo [HINT] Example local DB_URL: mongodb://127.0.0.1:27017
    echo [HINT] Frontend URL after start: http://localhost:5173 or http://localhost:5174
    exit /b 1
  )
)

echo [INFO] Starting frontend and backend...
call pnpm.cmd dev

endlocal