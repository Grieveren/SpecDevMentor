#!/bin/bash

echo "🚀 Starting CodeMentor AI Development Production Environment..."

# Clean up existing processes
pkill -f "tsx" || true
pkill -f "vite" || true

# Start infrastructure
docker-compose up -d postgres redis

# Wait for services
echo "Waiting for services to be ready..."
sleep 10

# Setup database
cd server
pnpm prisma generate
pnpm prisma db push
pnpm db:seed
cd ..

# Start server in development mode
echo "Starting server..."
cd server
pnpm dev &
SERVER_PID=$!
cd ..

# Wait for server to start
sleep 10

# Start client in development mode
echo "Starting client..."
cd client
pnpm dev &
CLIENT_PID=$!
cd ..

echo ""
echo "🎉 Development environment started!"
echo "Frontend: http://localhost:3000"
echo "Backend: http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for interrupt
trap 'echo "Stopping services..."; kill $SERVER_PID $CLIENT_PID 2>/dev/null; exit 0' INT
wait
