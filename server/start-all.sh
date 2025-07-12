#!/bin/bash

# Medical Bot - Start All Services
echo "🏥 Starting Medical Bot Services..."

# Start the main API server on port 3001
echo "🚀 Starting Main API Server (port 3001)..."
node index.js &
API_PID=$!

# Start the video call signaling server on port 3002  
echo "🎥 Starting Video Call Signaling Server (port 3002)..."
node videoCallServer.js &
VIDEO_PID=$!

echo "✅ All services started!"
echo "📡 Main API Server: http://localhost:3001"
echo "🎥 Video Call Server: ws://localhost:3002"
echo ""
echo "Press Ctrl+C to stop all services..."

# Function to cleanup background processes
cleanup() {
    echo ""
    echo "🛑 Stopping all services..."
    kill $API_PID 2>/dev/null
    kill $VIDEO_PID 2>/dev/null
    echo "✅ All services stopped."
    exit 0
}

# Trap Ctrl+C
trap cleanup INT

# Wait for any process to exit
wait
