@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
if exist "runtime\node.exe" (
  "runtime\node.exe" "scripts\serve.mjs" --open
  if errorlevel 1 pause
  exit /b
)
where node >nul 2>&1
if errorlevel 1 (
  echo 找不到 Node.js。請先安裝 Node.js 24，再重新開啟這個檔案。
  echo 請確認已完整解壓，保留 runtime 資料夾。不需要安裝 npm 套件。
  pause
  exit /b 1
)
if not exist "dist\index.html" (
  echo 找不到 dist\index.html。請確認完整解壓發佈包。
  echo 如果使用原始碼，請先執行 npm ci 與 npm run build。
  pause
  exit /b 1
)
node "scripts\serve.mjs" --open
if errorlevel 1 pause
