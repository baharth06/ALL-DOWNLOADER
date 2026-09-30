@echo off
setlocal
cd /d "%~dp0"
echo Starting ALL DOWNLOADER (Next.js + FastAPI worker)...
npm run dev:all
