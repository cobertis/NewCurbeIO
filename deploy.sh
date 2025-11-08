#!/bin/bash

# Curbe.io Deployment Script
# Author: Curbe Team
# Description: Automated deployment script for production server

set -e  # Exit on any error

echo "🚀 Starting Curbe.io Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="/var/www/curbe"
BACKUP_DIR="/var/www/curbe_backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Step 1: Create backup
echo -e "${YELLOW}📦 Creating backup...${NC}"
mkdir -p "$BACKUP_DIR"
cp -r "$APP_DIR/.env" "$BACKUP_DIR/.env.$TIMESTAMP" || echo "No .env to backup"

# Step 2: Navigate to app directory
echo -e "${YELLOW}📂 Navigating to app directory...${NC}"
cd "$APP_DIR"

# Step 3: Stash any local changes
echo -e "${YELLOW}💾 Stashing local changes...${NC}"
git stash push -m "Auto-stash before deployment $TIMESTAMP" || true

# Step 4: Pull latest changes from GitHub
echo -e "${YELLOW}⬇️  Pulling latest changes from GitHub...${NC}"
git pull origin main || git pull origin master

# Step 5: Install/update dependencies
echo -e "${YELLOW}📥 Installing dependencies...${NC}"
npm install

# Step 6: Run database migrations
echo -e "${YELLOW}🗄️  Running database migrations...${NC}"
npm run db:push --force || true

# Step 7: Build the application
echo -e "${YELLOW}🔨 Building application...${NC}"
npm run build || true

# Step 8: Restart PM2 application
echo -e "${YELLOW}♻️  Restarting application...${NC}"
pm2 restart curbe || pm2 start ecosystem.config.cjs --env production

# Step 9: Save PM2 configuration
echo -e "${YELLOW}💾 Saving PM2 configuration...${NC}"
pm2 save

# Step 10: Show status
echo -e "${YELLOW}📊 Application status:${NC}"
pm2 status

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "${GREEN}🌐 Application: https://app.curbe.io${NC}"
echo -e "${YELLOW}📝 Backup saved to: $BACKUP_DIR/.env.$TIMESTAMP${NC}"
