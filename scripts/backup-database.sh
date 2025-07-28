#!/bin/bash

# Database backup script for CodeMentor AI
set -e

# Configuration
NAMESPACE="codementor-ai"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
S3_BUCKET="${S3_BUCKET:-codementor-ai-backups}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Create backup directory
create_backup_dir() {
    mkdir -p ${BACKUP_DIR}
    log_info "Backup directory created: ${BACKUP_DIR}"
}

# Backup database
backup_database() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="${BACKUP_DIR}/codementor_ai_backup_${timestamp}.sql"
    
    log_info "Starting database backup..."
    
    # Get PostgreSQL pod
    local postgres_pod=$(kubectl get pods -n ${NAMESPACE} -l app=postgres -o jsonpath='{.items[0].metadata.name}')
    
    if [ -z "$postgres_pod" ]; then
        log_error "PostgreSQL pod not found"
        exit 1
    fi
    
    # Create backup
    kubectl exec -n ${NAMESPACE} ${postgres_pod} -- pg_dump -U postgres codementor_ai > ${backup_file}
    
    # Compress backup
    gzip ${backup_file}
    backup_file="${backup_file}.gz"
    
    log_info "Database backup created: ${backup_file}"
    
    # Upload to S3 if configured
    if [ ! -z "$S3_BUCKET" ] && command -v aws &> /dev/null; then
        log_info "Uploading backup to S3..."
        aws s3 cp ${backup_file} s3://${S3_BUCKET}/database/$(basename ${backup_file})
        log_info "Backup uploaded to S3"
    fi
    
    echo ${backup_file}
}

# Backup Redis data
backup_redis() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="${BACKUP_DIR}/redis_backup_${timestamp}.rdb"
    
    log_info "Starting Redis backup..."
    
    # Get Redis pod
    local redis_pod=$(kubectl get pods -n ${NAMESPACE} -l app=redis -o jsonpath='{.items[0].metadata.name}')
    
    if [ -z "$redis_pod" ]; then
        log_error "Redis pod not found"
        exit 1
    fi
    
    # Create backup
    kubectl exec -n ${NAMESPACE} ${redis_pod} -- redis-cli BGSAVE
    
    # Wait for backup to complete
    sleep 5
    
    # Copy backup file
    kubectl cp ${NAMESPACE}/${redis_pod}:/data/dump.rdb ${backup_file}
    
    # Compress backup
    gzip ${backup_file}
    backup_file="${backup_file}.gz"
    
    log_info "Redis backup created: ${backup_file}"
    
    # Upload to S3 if configured
    if [ ! -z "$S3_BUCKET" ] && command -v aws &> /dev/null; then
        log_info "Uploading Redis backup to S3..."
        aws s3 cp ${backup_file} s3://${S3_BUCKET}/redis/$(basename ${backup_file})
        log_info "Redis backup uploaded to S3"
    fi
    
    echo ${backup_file}
}

# Clean old backups
cleanup_old_backups() {
    log_info "Cleaning up old backups (older than ${RETENTION_DAYS} days)..."
    
    find ${BACKUP_DIR} -name "*.gz" -type f -mtime +${RETENTION_DAYS} -delete
    
    # Clean S3 backups if configured
    if [ ! -z "$S3_BUCKET" ] && command -v aws &> /dev/null; then
        local cutoff_date=$(date -d "${RETENTION_DAYS} days ago" +%Y-%m-%d)
        aws s3 ls s3://${S3_BUCKET}/database/ | while read -r line; do
            local file_date=$(echo $line | awk '{print $1}')
            local file_name=$(echo $line | awk '{print $4}')
            if [[ "$file_date" < "$cutoff_date" ]]; then
                aws s3 rm s3://${S3_BUCKET}/database/${file_name}
                log_info "Deleted old S3 backup: ${file_name}"
            fi
        done
        
        aws s3 ls s3://${S3_BUCKET}/redis/ | while read -r line; do
            local file_date=$(echo $line | awk '{print $1}')
            local file_name=$(echo $line | awk '{print $4}')
            if [[ "$file_date" < "$cutoff_date" ]]; then
                aws s3 rm s3://${S3_BUCKET}/redis/${file_name}
                log_info "Deleted old Redis S3 backup: ${file_name}"
            fi
        done
    fi
    
    log_info "Cleanup completed"
}

# Restore database from backup
restore_database() {
    local backup_file=$1
    
    if [ -z "$backup_file" ]; then
        log_error "Backup file not specified"
        exit 1
    fi
    
    if [ ! -f "$backup_file" ]; then
        log_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    log_warn "This will restore the database from backup. This action cannot be undone."
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Restore cancelled"
        exit 0
    fi
    
    log_info "Starting database restore from: $backup_file"
    
    # Get PostgreSQL pod
    local postgres_pod=$(kubectl get pods -n ${NAMESPACE} -l app=postgres -o jsonpath='{.items[0].metadata.name}')
    
    if [ -z "$postgres_pod" ]; then
        log_error "PostgreSQL pod not found"
        exit 1
    fi
    
    # Decompress if needed
    local restore_file=$backup_file
    if [[ $backup_file == *.gz ]]; then
        restore_file="${backup_file%.gz}"
        gunzip -c $backup_file > $restore_file
    fi
    
    # Drop existing database and recreate
    kubectl exec -n ${NAMESPACE} ${postgres_pod} -- psql -U postgres -c "DROP DATABASE IF EXISTS codementor_ai;"
    kubectl exec -n ${NAMESPACE} ${postgres_pod} -- psql -U postgres -c "CREATE DATABASE codementor_ai;"
    
    # Restore database
    kubectl exec -i -n ${NAMESPACE} ${postgres_pod} -- psql -U postgres codementor_ai < $restore_file
    
    # Clean up temporary file if created
    if [[ $backup_file == *.gz ]]; then
        rm $restore_file
    fi
    
    log_info "Database restore completed"
}

# Verify backup integrity
verify_backup() {
    local backup_file=$1
    
    if [ -z "$backup_file" ]; then
        log_error "Backup file not specified"
        exit 1
    fi
    
    if [ ! -f "$backup_file" ]; then
        log_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    log_info "Verifying backup integrity: $backup_file"
    
    # Check if file is compressed
    if [[ $backup_file == *.gz ]]; then
        if gzip -t $backup_file; then
            log_info "Backup file compression is valid"
        else
            log_error "Backup file compression is corrupted"
            exit 1
        fi
        
        # Test SQL content
        if gunzip -c $backup_file | head -n 10 | grep -q "PostgreSQL database dump"; then
            log_info "Backup file contains valid PostgreSQL dump"
        else
            log_error "Backup file does not contain valid PostgreSQL dump"
            exit 1
        fi
    else
        # Test SQL content directly
        if head -n 10 $backup_file | grep -q "PostgreSQL database dump"; then
            log_info "Backup file contains valid PostgreSQL dump"
        else
            log_error "Backup file does not contain valid PostgreSQL dump"
            exit 1
        fi
    fi
    
    log_info "Backup verification completed successfully"
}

# Main function
main() {
    case "${1:-backup}" in
        "backup")
            create_backup_dir
            backup_database
            backup_redis
            cleanup_old_backups
            ;;
        "restore")
            restore_database $2
            ;;
        "verify")
            verify_backup $2
            ;;
        "cleanup")
            cleanup_old_backups
            ;;
        *)
            echo "Usage: $0 {backup|restore <file>|verify <file>|cleanup}"
            exit 1
            ;;
    esac
}

main "$@"