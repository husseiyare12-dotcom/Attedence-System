@echo off
cd /d "%~dp0"
start "Attendance Website" /D "%~dp0" cmd.exe /k node server.js
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 3"
start "" "http://localhost:3000/login.html"
