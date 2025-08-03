---
inclusion: always
---

# Terminal Command Execution Guidelines

## Command Timeout Prevention

When executing terminal commands, always consider potential hanging scenarios and implement appropriate safeguards:

### High-Risk Commands to Avoid

- Long-running processes without timeout limits
- Interactive commands that wait for user input
- Network operations without connection timeouts
- File operations on large datasets without progress indicators
- npm commands without timeout or non-interactive flags
- curl commands without timeout parameters

### Critical NPM Command Patterns

#### Safe NPM Commands (ALWAYS USE THESE)

```bash
# Installation with timeout and non-interactive flags
npm install --no-audit --no-fund --silent --timeout=30000
npm ci --silent --no-audit --no-fund --timeout=30000

# Development server with timeout protection
timeout 30s npm run dev || echo "Server start timed out"

# Testing with explicit timeout
npm test -- --timeout=30000 --run

# Build commands with timeout
timeout 120s npm run build

# Package info without hanging
npm info <package> --json --timeout=10000
```

#### NPM Commands to NEVER Use Without Timeouts

```bash
# DANGEROUS - Can hang indefinitely
npm install
npm run dev
npm test
npm audit
npm update

# SAFE ALTERNATIVES
npm install --timeout=30000 --no-audit --no-fund
timeout 30s npm run dev
npm test -- --run --timeout=30000
npm audit --timeout=15000
npm update --timeout=60000
```

### Critical CURL Command Patterns

#### Safe CURL Commands (ALWAYS USE THESE)

```bash
# Basic request with timeout
curl --max-time 30 --connect-timeout 10 <url>

# POST request with timeout and retry
curl --max-time 30 --connect-timeout 10 --retry 3 --retry-delay 1 \
     -X POST -H "Content-Type: application/json" \
     -d '{"data":"value"}' <url>

# Download with timeout and progress
curl --max-time 60 --connect-timeout 10 --progress-bar <url> -o file.txt

# Silent request for scripts
curl --max-time 30 --connect-timeout 10 --silent --fail <url>
```

#### CURL Commands to NEVER Use Without Timeouts

```bash
# DANGEROUS - Can hang indefinitely
curl <url>
curl -X POST <url>

# SAFE ALTERNATIVES
curl --max-time 30 --connect-timeout 10 <url>
curl --max-time 30 --connect-timeout 10 -X POST <url>
```

### Windows PowerShell Equivalents

#### PowerShell Safe Patterns

```powershell
# NPM with timeout (PowerShell)
Start-Process -FilePath "npm" -ArgumentList "install","--timeout=30000","--silent" -Wait -TimeoutSec 60

# Web requests with timeout
Invoke-WebRequest -Uri $url -TimeoutSec 30 -ErrorAction Stop

# Process management
$process = Start-Process -FilePath "npm" -ArgumentList "run","dev" -PassThru
Start-Sleep -Seconds 30
if (!$process.HasExited) { $process.Kill() }
```

### Recommended Patterns

#### Use Timeout Wrappers

```bash
# Use timeout command for potentially long operations
timeout 30s npm install --silent --no-audit
timeout 60s docker build . --quiet
timeout 30s curl --silent --fail <url>
```

#### Background Process Management

```bash
# Start processes in background with proper cleanup
timeout 30s npm run dev &
DEV_PID=$!

# Always capture and manage process IDs
echo $DEV_PID > .dev.pid

# Implement cleanup on exit
trap 'kill $DEV_PID 2>/dev/null' EXIT
```

#### Non-Interactive Execution

```bash
# Use non-interactive flags when available
npm ci --silent --no-audit --no-fund --timeout=30000
docker build --quiet .
git clone --quiet <repo>
curl --silent --fail --max-time 30 <url>
```

### Development Server Management

For development servers (especially Vite on port 5173):

#### Pre-Start Cleanup (MANDATORY)

```bash
# Kill existing processes before starting new ones
pkill -f "vite" || true
pkill -f "npm.*dev" || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true

# Wait for cleanup
sleep 2

# Start with timeout protection
timeout 30s npm run dev &
DEV_PID=$!
echo "Started dev server with PID: $DEV_PID"
```

#### PowerShell Server Management

```powershell
# Kill existing processes
Get-Process | Where-Object {$_.ProcessName -like "*node*"} | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process | Where-Object {$_.CommandLine -like "*vite*"} | Stop-Process -Force -ErrorAction SilentlyContinue

# Start with timeout
$process = Start-Process -FilePath "npm" -ArgumentList "run","dev" -PassThru
Start-Sleep -Seconds 30
if (!$process.HasExited) { 
    Write-Host "Dev server started successfully"
} else {
    Write-Host "Dev server failed to start"
}
```

### Monitoring and Cleanup

#### Linux/Mac Commands

```bash
# Check running processes (safe)
ps aux | grep -E "(node|npm|vite)" | grep -v grep

# Kill stuck processes
pkill -f "npm.*dev"
pkill -f "vite"

# Check port usage
lsof -i :5173 | grep LISTEN

# Clean up background jobs
jobs
kill %1 %2 %3 2>/dev/null || true
```

#### Windows PowerShell Commands

```powershell
# Check running processes
Get-Process | Where-Object {$_.ProcessName -like "*node*" -or $_.ProcessName -like "*npm*"}

# Kill processes by name
Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "npm" -Force -ErrorAction SilentlyContinue

# Check port usage
netstat -ano | findstr :5173
```

### Error Handling and Recovery

#### Timeout Detection and Recovery

```bash
# Function to run command with timeout and recovery
run_with_timeout() {
    local cmd="$1"
    local timeout_sec="$2"
    local max_retries="${3:-3}"
    
    for i in $(seq 1 $max_retries); do
        echo "Attempt $i/$max_retries: $cmd"
        
        if timeout $timeout_sec $cmd; then
            echo "Command succeeded on attempt $i"
            return 0
        else
            echo "Command failed/timed out on attempt $i"
            sleep 2
        fi
    done
    
    echo "Command failed after $max_retries attempts"
    return 1
}

# Usage examples
run_with_timeout "npm install --silent --timeout=30000" 60 3
run_with_timeout "curl --max-time 30 --silent $url" 35 2
```

#### PowerShell Error Handling

```powershell
function Invoke-WithTimeout {
    param(
        [string]$Command,
        [int]$TimeoutSeconds = 30,
        [int]$MaxRetries = 3
    )
    
    for ($i = 1; $i -le $MaxRetries; $i++) {
        Write-Host "Attempt $i/$MaxRetries : $Command"
        
        try {
            $job = Start-Job -ScriptBlock { Invoke-Expression $using:Command }
            if (Wait-Job $job -Timeout $TimeoutSeconds) {
                $result = Receive-Job $job
                Remove-Job $job
                Write-Host "Command succeeded on attempt $i"
                return $result
            } else {
                Remove-Job $job -Force
                Write-Host "Command timed out on attempt $i"
            }
        } catch {
            Write-Host "Command failed on attempt $i : $_"
        }
        
        Start-Sleep -Seconds 2
    }
    
    throw "Command failed after $MaxRetries attempts"
}
```

### Mandatory Command Patterns for AI Agents

#### ALWAYS Use These Patterns

```bash
# NPM operations
npm install --silent --no-audit --no-fund --timeout=30000
npm ci --silent --no-audit --no-fund --timeout=30000
timeout 30s npm run dev
npm test -- --run --timeout=30000

# CURL operations  
curl --max-time 30 --connect-timeout 10 --silent --fail <url>
curl --max-time 30 --connect-timeout 10 --retry 3 <url>

# Development servers
timeout 30s npm run dev &
timeout 30s npm start &

# Process cleanup before starting
pkill -f "vite" || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true
```

#### NEVER Use These Commands (Will Hang)

```bash
# FORBIDDEN - These will hang indefinitely
npm install
npm run dev
npm start
curl <url>
wget <url>
npm test
npm audit

# Use the safe alternatives above instead
```
