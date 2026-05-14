@echo off
cd /d "%~dp0"
"C:\Program Files\nodejs\node.exe" node_modules\next\dist\bin\next start > prod-server.log 2>&1
