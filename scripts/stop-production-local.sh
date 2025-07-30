#!/bin/bash

echo "🛑 Stopping CodeMentor AI Local Production Environment..."

# Kill application processes
if [ -f logs/server.pid ]; then
    SERVER_PID=$(cat logs/server.pid)
    if kill -0 $SERVER_PID 2>/dev/null; then
        kill $SERVER_PID
        echo "✅ Server stopped"
    fi
    rm -f logs/server.pid
fi

if [ -f logs/client.pid ]; then
    CLIENT_PID=$(cat logs/client.pid)
    if kill -0 $CLIENT_PID 2>/dev/null; then
        kill $CLIENT_PID
        echo "✅ Client stopped"
    fi
    rm -f logs/client.pid
fi

# Stop Docker services
docker-compose down

echo "✅ All services stopped"