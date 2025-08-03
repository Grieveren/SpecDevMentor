---
inclusion: always
---

# AI Agent Command Execution Safety

## CRITICAL: Commands That Will Hang the AI Agent

These commands MUST NEVER be executed without proper timeout and non-interactive flags:

### ❌ FORBIDDEN Commands (Will Hang)

```bash
# NPM commands without timeouts
npm install
npm run dev
npm start
npm test
npm audit
npm update
npm run build

# Network commands without timeouts
curl <url>
wget <url>
fetch <url>

# Interactive commands
git push (without credentials)
ssh <host>
sudo <command>
```

### ✅ REQUIRED Safe Alternatives

```bash
# NPM with mandatory timeouts and flags
npm install --silent --no-audit --no-fund --timeout=30000
timeout 30s npm run dev
timeout 30s npm start
npm test -- --run --timeout=30000
npm audit --timeout=15000
timeout 60s npm run build

# Network with mandatory timeouts
curl --max-time 30 --connect-timeout 10 --silent --fail <url>
wget --timeout=30 --tries=3 <url>

# Non-interactive git
git push origin main --force-with-lease
```

## Mandatory Pre-Command Checks

Before running ANY development server:

```bash
# 1. Kill existing processes
pkill -f "vite" || true
pkill -f "npm.*dev" || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true

# 2. Wait for cleanup
sleep 2

# 3. Start with timeout
timeout 30s npm run dev &
```

## Windows PowerShell Safety

```powershell
# Kill processes safely
Get-Process | Where-Object {$_.ProcessName -like "*node*"} | Stop-Process -Force -ErrorAction SilentlyContinue

# Run with timeout
$process = Start-Process -FilePath "npm" -ArgumentList "run","dev" -PassThru -NoNewWindow
Start-Sleep -Seconds 30
if (!$process.HasExited) { 
    Write-Host "Process started successfully"
}
```

## Testing Commands Safety

```bash
# SAFE test execution
npm test -- --run --timeout=30000
npm run test:unit -- --run
vitest run --timeout=30000

# UNSAFE (will hang waiting for input)
npm test
vitest
jest
```

## Emergency Recovery

If a command hangs:

```bash
# Kill all node processes
pkill -f node
pkill -f npm

# Kill by port
lsof -ti:5173 | xargs kill -9

# PowerShell
Stop-Process -Name "node" -Force
Stop-Process -Name "npm" -Force
```

## Command Validation Checklist

Before executing ANY command, verify:

- [ ] Has explicit timeout (--timeout, timeout command, or --max-time)
- [ ] Uses non-interactive flags (--silent, --no-audit, --ci)
- [ ] Has proper error handling (|| true, 2>/dev/null)
- [ ] Includes cleanup commands for processes/ports
- [ ] Uses background execution (&) for long-running processes

## Auto-Timeout Wrapper Function

Use this wrapper for all potentially hanging commands:

```bash
safe_execute() {
    local cmd="$1"
    local timeout_sec="${2:-30}"
    
    echo "Executing with ${timeout_sec}s timeout: $cmd"
    
    if timeout $timeout_sec bash -c "$cmd"; then
        echo "✅ Command completed successfully"
        return 0
    else
        echo "❌ Command timed out or failed"
        return 1
    fi
}

# Usage
safe_execute "npm install --silent --timeout=30000" 60
safe_execute "curl --max-time 30 --silent $url" 35
```