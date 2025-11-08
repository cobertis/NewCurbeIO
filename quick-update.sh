#!/bin/bash

# Curbe.io Quick Update Script
# For small updates without full deployment process

set -e

echo "⚡ Quick update started..."

cd /var/www/curbe
git pull origin main || git pull origin master
pm2 restart curbe

echo "✅ Update complete!"
pm2 status
