@echo off
REM Medical Bot - Start All Services (Windows)

echo 🏥 Starting Medical Bot Services...

REM Start the main API server on port 3001
echo 🚀 Starting Main API Server (port 3001)...
start "Main API Server" cmd /k "node index.js"

REM Wait a moment for the first server to start
timeout /t 2 >nul

REM Start the video call signaling server on port 3002
echo 🎥 Starting Video Call Signaling Server (port 3002)...
start "Video Call Server" cmd /k "node videoCallServer.js"

echo ✅ All services started!
echo 📡 Main API Server: http://localhost:3001
echo 🎥 Video Call Server: ws://localhost:3002
echo.
echo Press any key to continue...
pause >nul
