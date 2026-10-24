$project = Split-Path -Parent $MyInvocation.MyCommand.Path
$mongo = 'C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe'
$data = Join-Path $project 'mongo-data8'

if (-not (Get-NetTCPConnection -LocalPort 27017 -State Listen -ErrorAction SilentlyContinue)) {
    Start-Process -FilePath $mongo -ArgumentList '--dbpath', $data, '--bind_ip', '127.0.0.1', '--port', '27017'
    Start-Sleep -Seconds 3
}

Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$project'; npm start"
Start-Sleep -Seconds 3
Start-Process 'http://localhost:3000/login.html'
