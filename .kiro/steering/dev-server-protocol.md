---
inclusion: always
---

# Development Server Management Protocol

## Critical Rule: Clean Process Management

**Always terminate existing development servers before starting new ones to prevent port conflicts and ensure consistent localhost:5173 access.**

## Required Process Cleanup Steps (AI Agent Safe)

Execute these commands in sequence before starting any development server:

1. **Kill existing processes (safe, non-hanging):**
   ```bash
   pkill -f "vite" || true
   pkill -f "npm.*dev" || true
   pkill -f "ts-node-dev" || true
   ```

2. **Kill processes by port (safe):**
   ```bash
   lsof -ti:5173 | xargs kill -9 2>/dev/null || true
   lsof -ti:3001 | xargs kill -9 2>/dev/null || true
   ```

3. **Wait for cleanup:**
   ```bash
   sleep 2
   ```

4. **Verify port is available (with timeout):**
   ```bash
   timeout 5s lsof -i :5173 || echo "Port 5173 is available"
   timeout 5s lsof -i :3001 || echo "Port 3001 is available"
   ```

5. **Start development server with timeout protection:**
   ```bash
   timeout 30s npm run dev &
   DEV_PID=$!
   echo "Started dev server with PID: $DEV_PID"
   ```

## Windows PowerShell Cleanup (AI Agent Safe)

```powershell
# Kill existing processes safely
Get-Process | Where-Object {$_.ProcessName -like "*node*"} | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process | Where-Object {$_.ProcessName -like "*npm*"} | Stop-Process -Force -ErrorAction SilentlyContinue

# Wait for cleanup
Start-Sleep -Seconds 2

# Check port availability
$port5173 = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue
$port3001 = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue

if (!$port5173) { Write-Host "Port 5173 is available" }
if (!$port3001) { Write-Host "Port 3001 is available" }

# Start with timeout protection
$process = Start-Process -FilePath "npm" -ArgumentList "run","dev" -PassThru -NoNewWindow
Start-Sleep -Seconds 30
if (!$process.HasExited) { 
    Write-Host "Dev server started successfully with PID: $($process.Id)"
}
```

## Development Server Commands (AI Agent Safe)

### Client Development Server (Safe)
```bash
# With timeout protection
timeout 30s npm run dev --prefix client &
CLIENT_PID=$!
echo "Client server started with PID: $CLIENT_PID"
```
- Runs on `localhost:5173`
- Uses Vite for fast HMR
- Proxies API requests to `localhost:3001`

### Server Development Server (Safe)
```bash
# With timeout protection
timeout 30s npm run dev --prefix server &
SERVER_PID=$!
echo "Server started with PID: $SERVER_PID"
```
- Runs on `localhost:3001`
- Uses ts-node-dev for hot reloading
- Connects to PostgreSQL database

### Full Stack Development (AI Agent Safe)
```bash
# Kill existing processes first
pkill -f "vite" || true
pkill -f "npm.*dev" || true
pkill -f "ts-node-dev" || true
sleep 2

# Start server with timeout
timeout 30s npm run dev --prefix server &
SERVER_PID=$!
echo "Server started with PID: $SERVER_PID"

# Wait for server to initialize
sleep 5

# Start client with timeout
timeout 30s npm run dev --prefix client &
CLIENT_PID=$!
echo "Client started with PID: $CLIENT_PID"

# Store PIDs for cleanup
echo "$SERVER_PID" > .server.pid
echo "$CLIENT_PID" > .client.pid
```

### Emergency Shutdown
```bash
# Kill all development processes
pkill -f "vite"
pkill -f "npm.*dev"
pkill -f "ts-node-dev"

# Or use stored PIDs
if [ -f .server.pid ]; then kill $(cat .server.pid) 2>/dev/null; rm .server.pid; fi
if [ -f .client.pid ]; then kill $(cat .client.pid) 2>/dev/null; rm .client.pid; fi
```

## Port Configuration

- **Client (Vite):** 5173
- **Server (Express):** 3001
- **Database (PostgreSQL):** 5432
- **Redis:** 6379

## Troubleshooting

### Common Issues
- **EADDRINUSE error:** Port already in use - follow cleanup steps
- **Connection refused:** Server not running or wrong port
- **Proxy errors:** Check server is running on port 3001

### Process Management (AI Agent Safe)
- Use `pkill -f vite || true` to safely kill all Vite processes
- Use `pkill -f ts-node-dev || true` to safely kill server processes  
- Use `lsof -ti:5173 | xargs kill -9 2>/dev/null || true` for port-based cleanup
- Always include `|| true` to prevent command failures from stopping execution
- Use `timeout` command wrapper for all npm operations
- Check `package.json` scripts for exact commands

### AI Agent Command Safety Rules
```bash
# NEVER use these (will hang):
npm run dev
npm start
npm install

# ALWAYS use these instead:
timeout 30s npm run dev &
timeout 30s npm start &
npm install --timeout=30000 --silent --no-audit
```

## Why This Protocol Matters

- Prevents port conflicts that break development workflow
- Ensures consistent localhost URLs across team
- Avoids hanging processes that consume resources
- Maintains reliable development environment
- Reduces debugging time for connection issues