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

### Recommended Patterns

#### Use Timeout Wrappers

```bash
# Use timeout command for potentially long operations
timeout 30s npm install
timeout 60s docker build .
```

#### Background Process Management

```bash
# Start processes in background with proper cleanup
npm run dev &
DEV_PID=$!

# Always capture and manage process IDs
echo $DEV_PID > .dev.pid

# Implement cleanup on exit
trap 'kill $DEV_PID 2>/dev/null' EXIT
```

#### Non-Interactive Execution

```bash
# Use non-interactive flags when available
npm ci --silent
docker build --quiet .
git clone --quiet <repo>
```

### Development Server Management

For development servers (especially Vite on port 5173):

- Always check for existing processes before starting new ones
- Use process cleanup commands before starting servers
- Implement proper signal handling for graceful shutdowns

### Monitoring and Cleanup

- Use `ps aux | grep <process>` to check running processes
- Implement `kill -9 <PID>` for stuck processes
- Use `lsof -i :<port>` to check port usage
- Always clean up background jobs with `jobs` and `kill %<job_number>`

### Error Handling

- Implement proper exit codes and error checking
- Use `set -e` in bash scripts to exit on first error
- Provide clear error messages for timeout scenarios
- Log command execution for debugging purposes
