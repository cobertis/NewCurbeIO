#!/bin/bash
# Automated deployment script for Curbe Admin
# This script is called by GitHub webhook or Super Admin button

set -e

APP_DIR="/var/www/curbe"
LOG_FILE="/var/log/curbe-deploy.log"
LOCK_FILE="/tmp/curbe-deploy.lock"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Check for lock file to prevent concurrent deployments
if [ -f "$LOCK_FILE" ]; then
    log "ERROR: Deployment already in progress. Exiting."
    exit 1
fi

# Create lock file
touch "$LOCK_FILE"
trap "rm -f $LOCK_FILE" EXIT

log "========================================="
log "Starting deployment..."
log "========================================="

cd "$APP_DIR"

# Step 1: Pull latest changes from GitHub
log "Step 1: Pulling latest changes from GitHub..."
git fetch origin main
git reset --hard origin/main
log "Git pull completed."

# Step 2: Check if package-lock.json changed and install dependencies
log "Step 2: Installing dependencies..."
npm ci --production=false
log "Dependencies installed."

# Step 3: Build the application
log "Step 3: Building application..."
npm run build
log "Build completed."

# Step 4: Run database migrations if needed
log "Step 4: Checking database..."
npm run db:push --force 2>/dev/null || true
log "Database check completed."

# Step 5: Restart PM2
log "Step 5: Restarting PM2..."
pm2 restart curbe-admin --update-env
log "PM2 restarted."

# Step 6: Save PM2 state
pm2 save
log "PM2 state saved."

log "========================================="
log "Deployment completed successfully!"
log "========================================="

exit 0
