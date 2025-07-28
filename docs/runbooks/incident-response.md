# Incident Response Runbook

## Overview

This runbook provides step-by-step procedures for responding to incidents in the CodeMentor AI platform.

## Incident Severity Levels

### Critical (P0)
- Complete service outage
- Data loss or corruption
- Security breach
- **Response Time**: Immediate (< 15 minutes)
- **Resolution Time**: < 4 hours

### High (P1)
- Significant feature degradation
- Performance issues affecting > 50% of users
- Authentication/authorization failures
- **Response Time**: < 1 hour
- **Resolution Time**: < 24 hours

### Medium (P2)
- Minor feature issues
- Performance degradation affecting < 50% of users
- Non-critical API failures
- **Response Time**: < 4 hours
- **Resolution Time**: < 72 hours

### Low (P3)
- Cosmetic issues
- Documentation problems
- Minor performance issues
- **Response Time**: < 24 hours
- **Resolution Time**: < 1 week

## Incident Response Process

### 1. Detection and Alert
- Monitor alerts from monitoring systems
- Check health endpoints: `/health`, `/health/detailed`
- Review error tracking dashboard
- User reports via support channels

### 2. Initial Assessment
```bash
# Check system health
curl https://api.codementor-ai.com/health/detailed

# Check active alerts
kubectl get pods -n codementor-ai
kubectl get services -n codementor-ai
kubectl describe ingress -n codementor-ai

# Check logs
kubectl logs -f deployment/codementor-server -n codementor-ai --tail=100
kubectl logs -f deployment/codementor-client -n codementor-ai --tail=100
```

### 3. Incident Declaration
- Create incident ticket in tracking system
- Notify incident response team
- Set up communication channel (Slack/Teams)
- Assign incident commander

### 4. Investigation and Diagnosis

#### Database Issues
```bash
# Check database connectivity
kubectl exec -it deployment/postgres -n codementor-ai -- psql -U postgres -c "SELECT 1;"

# Check database performance
kubectl exec -it deployment/postgres -n codementor-ai -- psql -U postgres -c "
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  rows
FROM pg_stat_statements 
ORDER BY total_time DESC 
LIMIT 10;"

# Check database connections
kubectl exec -it deployment/postgres -n codementor-ai -- psql -U postgres -c "
SELECT 
  count(*) as connections,
  state
FROM pg_stat_activity 
GROUP BY state;"
```

#### Redis Issues
```bash
# Check Redis connectivity
kubectl exec -it deployment/redis -n codementor-ai -- redis-cli ping

# Check Redis memory usage
kubectl exec -it deployment/redis -n codementor-ai -- redis-cli info memory

# Check Redis performance
kubectl exec -it deployment/redis -n codementor-ai -- redis-cli info stats
```

#### Application Issues
```bash
# Check application logs
kubectl logs -f deployment/codementor-server -n codementor-ai | grep ERROR

# Check resource usage
kubectl top pods -n codementor-ai
kubectl top nodes

# Check application metrics
curl -H "Authorization: Bearer $TOKEN" https://api.codementor-ai.com/monitoring/metrics
```

### 5. Mitigation and Resolution

#### Service Restart
```bash
# Restart server pods
kubectl rollout restart deployment/codementor-server -n codementor-ai

# Restart client pods
kubectl rollout restart deployment/codementor-client -n codementor-ai

# Check rollout status
kubectl rollout status deployment/codementor-server -n codementor-ai
```

#### Scale Resources
```bash
# Scale up server pods
kubectl scale deployment codementor-server --replicas=5 -n codementor-ai

# Scale up client pods
kubectl scale deployment codementor-client --replicas=3 -n codementor-ai
```

#### Database Recovery
```bash
# Restore from backup
./scripts/backup-database.sh restore /path/to/backup.sql.gz

# Check database integrity
kubectl exec -it deployment/postgres -n codementor-ai -- psql -U postgres -c "
SELECT schemaname, tablename, attname, n_distinct, correlation 
FROM pg_stats 
WHERE schemaname = 'public';"
```

#### Rollback Deployment
```bash
# Rollback to previous version
kubectl rollout undo deployment/codementor-server -n codementor-ai
kubectl rollout undo deployment/codementor-client -n codementor-ai

# Or use deployment script
./scripts/deploy.sh rollback
```

### 6. Communication
- Update incident ticket with findings
- Notify stakeholders of status
- Provide regular updates (every 30 minutes for P0/P1)
- Update status page if applicable

### 7. Resolution and Closure
- Verify fix resolves the issue
- Monitor for 30 minutes to ensure stability
- Update incident ticket with resolution
- Schedule post-incident review

## Common Incident Scenarios

### Database Connection Failures

**Symptoms:**
- 500 errors in application
- "Database connection failed" in logs
- Health check failures

**Investigation:**
```bash
# Check database pod status
kubectl get pods -l app=postgres -n codementor-ai

# Check database logs
kubectl logs -f deployment/postgres -n codementor-ai

# Check connection limits
kubectl exec -it deployment/postgres -n codementor-ai -- psql -U postgres -c "SHOW max_connections;"
```

**Resolution:**
1. Restart database pod if crashed
2. Check connection pool configuration
3. Scale database resources if needed
4. Review slow queries and optimize

### High Memory Usage

**Symptoms:**
- Pods being killed (OOMKilled)
- Slow response times
- Memory alerts

**Investigation:**
```bash
# Check memory usage
kubectl top pods -n codementor-ai
kubectl describe pod <pod-name> -n codementor-ai

# Check memory limits
kubectl get pods -o jsonpath='{.items[*].spec.containers[*].resources}' -n codementor-ai
```

**Resolution:**
1. Increase memory limits in deployment
2. Identify memory leaks in application
3. Scale horizontally instead of vertically
4. Optimize application memory usage

### SSL Certificate Expiration

**Symptoms:**
- SSL/TLS errors
- Browser security warnings
- Certificate validation failures

**Investigation:**
```bash
# Check certificate expiration
kubectl get certificates -n codementor-ai
kubectl describe certificate codementor-tls -n codementor-ai

# Check cert-manager logs
kubectl logs -f deployment/cert-manager -n cert-manager
```

**Resolution:**
1. Renew certificate manually if needed
2. Check cert-manager configuration
3. Verify DNS configuration
4. Update certificate issuer if needed

### Performance Degradation

**Symptoms:**
- Slow response times
- High CPU/memory usage
- User complaints

**Investigation:**
```bash
# Check resource usage
kubectl top pods -n codementor-ai
kubectl top nodes

# Check application metrics
curl -H "Authorization: Bearer $TOKEN" https://api.codementor-ai.com/monitoring/metrics

# Check database performance
kubectl exec -it deployment/postgres -n codementor-ai -- psql -U postgres -c "
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;"
```

**Resolution:**
1. Scale application horizontally
2. Optimize database queries
3. Clear Redis cache if needed
4. Review and optimize application code

## Post-Incident Activities

### Immediate (Within 24 hours)
- Document timeline of events
- Identify root cause
- Implement immediate fixes
- Update monitoring/alerting if needed

### Short-term (Within 1 week)
- Conduct post-incident review meeting
- Create action items for improvements
- Update runbooks and documentation
- Implement additional monitoring

### Long-term (Within 1 month)
- Implement systemic improvements
- Update disaster recovery procedures
- Conduct incident response training
- Review and update SLAs

## Emergency Contacts

### On-Call Rotation
- **Primary**: [On-call engineer]
- **Secondary**: [Backup engineer]
- **Escalation**: [Engineering manager]

### External Contacts
- **Infrastructure Provider**: [Cloud provider support]
- **DNS Provider**: [DNS provider support]
- **Certificate Authority**: [CA support]

## Tools and Resources

### Monitoring Dashboards
- Health Dashboard: https://api.codementor-ai.com/monitoring/health/detailed
- Error Tracking: https://api.codementor-ai.com/monitoring/errors/stats
- Alert Management: https://api.codementor-ai.com/monitoring/alerts/active

### Useful Commands
```bash
# Quick health check
kubectl get pods -n codementor-ai
kubectl get services -n codementor-ai
kubectl get ingress -n codementor-ai

# Check recent events
kubectl get events -n codementor-ai --sort-by='.lastTimestamp'

# Port forward for local debugging
kubectl port-forward service/codementor-server-service 8080:3001 -n codementor-ai

# Execute commands in pods
kubectl exec -it deployment/codementor-server -n codementor-ai -- /bin/sh
```

### Log Locations
- Application logs: `/app/logs/`
- nginx logs: `/var/log/nginx/`
- Database logs: `/var/log/postgresql/`

---

**Last Updated**: $(date)
**Version**: 1.0.0