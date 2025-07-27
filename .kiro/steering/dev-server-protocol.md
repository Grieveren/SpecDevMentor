---
inclusion: always
---

# Development Server Management Protocol

## Critical Rule: Clean Process Management

**Always terminate existing development servers before starting new ones to prevent port conflicts and ensure consistent localhost:5173 access.**

## Required Process Cleanup Steps

Execute these commands in sequence before starting any development server:

1. **Check for existing Vite processes:**
   ```bash
   ps aux | grep vite
   ```

2. **Check for background jobs:**
   ```bash
   jobs
   ```

3. **Verify port 5173 usage:**
   ```bash
   lsof -i :5173
   ```

4. **Terminate found processes:**
   ```bash
   kill -9 [PID1] [PID2] [PID3]
   ```

5. **Kill background jobs:**
   ```bash
   kill %1 %2 %3
   ```

6. **Confirm port is available:**
   ```bash
   lsof -i :5173
   ```
   (Should return no output)

7. **Start development server:**
   ```bash
   npm run dev &
   ```

## Development Server Commands

### Client Development Server
```bash
cd client && npm run dev
```
- Runs on `localhost:5173`
- Uses Vite for fast HMR
- Proxies API requests to `localhost:3001`

### Server Development Server
```bash
cd server && npm run dev
```
- Runs on `localhost:3001`
- Uses ts-node-dev for hot reloading
- Connects to PostgreSQL database

### Full Stack Development
```bash
# Terminal 1: Start server
cd server && npm run dev

# Terminal 2: Start client (after cleanup)
cd client && npm run dev
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

### Process Management
- Use `pkill -f vite` to kill all Vite processes
- Use `pkill -f ts-node-dev` to kill server processes
- Check `package.json` scripts for exact commands

## Why This Protocol Matters

- Prevents port conflicts that break development workflow
- Ensures consistent localhost URLs across team
- Avoids hanging processes that consume resources
- Maintains reliable development environment
- Reduces debugging time for connection issues