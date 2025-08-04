#!/bin/bash

set -e

echo "Starting comprehensive build validation..."

# Validate client build
echo "Building client..."
npm run build:client
CLIENT_STATUS=$?

if [ $CLIENT_STATUS -eq 0 ]; then
  echo "✓ Client build successful."
else
  echo "✗ Client build failed!"
  exit 1
fi

# Validate server build
echo "Building server..."
npm run build:server
SERVER_STATUS=$?

if [ $SERVER_STATUS -eq 0 ]; then
  echo "✓ Server build successful."
else
  echo "✗ Server build failed!"
  exit 1
fi

echo ""
echo "Validating build artifacts..."

# Check if artifacts exist
if [ ! -d "client/dist" ]; then
  echo "✗ Client dist directory not found!"
  exit 1
fi

if [ ! -d "server/dist" ]; then
  echo "✗ Server dist directory not found!"
  exit 1
fi

# Validate client artifact
echo "Testing client artifact..."
python3 -m http.server 8080 -d client/dist &> /dev/null &
CLIENT_PID=$!

sleep 2

CLIENT_TEST=$(curl -s http://localhost:8080/index.html 2>/dev/null | grep -i "<title>" || echo "")

kill $CLIENT_PID 2>/dev/null || true
wait $CLIENT_PID 2>/dev/null || true

if [[ "$CLIENT_TEST" == *"title"* ]]; then
  echo "✓ Client artifact served successfully."
else
  echo "✗ Client artifact serving failed!"
  exit 1
fi

# Validate server artifact
echo "Testing server artifact..."
NODE_ENV=production node server/dist/production-server.js &> /dev/null &
SERVER_PID=$!

sleep 3

SERVER_TEST=$(curl -s http://localhost:3001/health 2>/dev/null || echo "")

kill $SERVER_PID 2>/dev/null || true
wait $SERVER_PID 2>/dev/null || true

if [[ "$SERVER_TEST" == *'"status":"OK"'* ]]; then
  echo "✓ Server artifact started and responded successfully."
else
  echo "✗ Server artifact validation failed!"
  echo "Server response: $SERVER_TEST"
  exit 1
fi

# Check artifact sizes
echo ""
echo "Build artifact sizes:"
CLIENT_SIZE=$(du -sh client/dist 2>/dev/null | cut -f1)
SERVER_SIZE=$(du -sh server/dist 2>/dev/null | cut -f1)
echo "  Client: $CLIENT_SIZE"
echo "  Server: $SERVER_SIZE"

echo "Comprehensive build validation completed successfully!"

