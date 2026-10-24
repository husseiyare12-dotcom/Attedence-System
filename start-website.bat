@echo off
cd /d "%~dp0"
start "MongoDB - Attendance System" powershell -NoExit -ExecutionPolicy Bypass -Command "& 'C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe' --dbpath '%~dp0mongo-data8' --bind_ip 127.0.0.1 --port 27017"
timeout /t 4 /nobreak >nul
start "Attendance Website" powershell -NoExit -ExecutionPolicy Bypass -Command "Set-Location '%~dp0'; npm start"
timeout /t 5 /nobreak >nul
start "" "http://localhost:3000/login.html"
