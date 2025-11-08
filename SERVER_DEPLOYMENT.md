# Curbe.io - Server Deployment Guide

## 📋 Quick Reference

### First Time Setup on Server

```bash
# 1. Clone repository
cd /var/www
git clone https://github.com/cobertis/NewCurbeIO curbe
cd curbe

# 2. Install dependencies
npm install

# 3. Copy environment file
cp .env.example .env
nano .env  # Edit with production values

# 4. Setup database
npm run db:push --force

# 5. Build application
npm run build

# 6. Start with PM2
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup  # Follow instructions to enable on boot
```

---

## 🚀 Deployment Scripts

### Full Deployment (Recommended)
Use this for major updates, dependency changes, or database migrations:

```bash
cd /var/www/curbe
./deploy.sh
```

**What it does:**
- ✅ Creates backup of .env file
- ✅ Stashes local changes
- ✅ Pulls latest code from GitHub
- ✅ Installs/updates dependencies
- ✅ Runs database migrations
- ✅ Builds application
- ✅ Restarts PM2 process
- ✅ Shows application status

---

### Quick Update (Fast)
Use this for small code changes without dependency updates:

```bash
cd /var/www/curbe
./quick-update.sh
```

**What it does:**
- ✅ Pulls latest code
- ✅ Restarts application
- ✅ Shows status

---

## 🔧 Common Tasks

### View Application Logs
```bash
pm2 logs curbe
pm2 logs curbe --lines 100  # Last 100 lines
```

### Check Application Status
```bash
pm2 status
pm2 monit  # Real-time monitoring
```

### Restart Application
```bash
pm2 restart curbe
```

### Stop Application
```bash
pm2 stop curbe
```

### View Environment Variables
```bash
cat /var/www/curbe/.env
```

### Database Operations
```bash
cd /var/www/curbe

# Push schema changes
npm run db:push

# Force push (if data loss warning)
npm run db:push --force

# Access database directly
psql -h 74.208.158.174 -p 5432 -U curbeapp -d curbe
```

---

## 🔐 Git Credentials Setup

### Configure Git (One-time)
```bash
git config --global user.name "Your Name"
git config --global user.email "admin@prolinkhealth.com"
git config --global credential.helper store
```

### First Pull (Enter credentials once)
```bash
cd /var/www/curbe
git pull origin main
# Enter GitHub username
# Enter GitHub Personal Access Token (NOT password)
# Credentials will be saved automatically
```

### Generate GitHub Personal Access Token
1. Go to: https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Select scopes: `repo` (full control)
4. Copy token and use as password when git asks

---

## 🌐 Webhook Configuration

Update these webhooks to point to production:

### Stripe Webhooks
- URL: `https://app.curbe.io/api/stripe/webhook`
- Events: `customer.subscription.*`, `invoice.*`, `payment_intent.*`

### Twilio Webhooks
- SMS URL: `https://app.curbe.io/api/twilio/webhook/sms`
- Method: POST

### BulkVS Webhooks
- URL: `https://app.curbe.io/api/bulkvs/webhook`
- Method: POST
- Authentication: Bearer token in `BULKVS_WEBHOOK_SECRET`

---

## 🗄️ Database Connection

**Production Database:**
- Host: `74.208.158.174`
- Port: `5432`
- Database: `curbe`
- User: `curbeapp`
- Password: `CurbeApp2024Secure!`

**Connection String:**
```
postgresql://curbeapp:CurbeApp2024Secure!@74.208.158.174:5432/curbe?sslmode=require
```

---

## 🛡️ Security Checklist

- [ ] PostgreSQL port restricted (not 0.0.0.0/0)
- [ ] Fail2ban configured for SSH
- [ ] Fail2ban configured for PostgreSQL
- [ ] SSL certificates renewed (Let's Encrypt)
- [ ] Firewall rules configured (UFW)
- [ ] Environment variables secured
- [ ] GitHub webhooks use secrets
- [ ] Stripe webhooks use signature verification
- [ ] Session secret is strong and unique

---

## 📊 Monitoring

### Check PM2 Process
```bash
pm2 status
pm2 monit
pm2 info curbe
```

### Check Nginx Status
```bash
sudo systemctl status nginx
sudo nginx -t  # Test configuration
sudo systemctl reload nginx  # Reload after config changes
```

### Check System Resources
```bash
htop
df -h  # Disk usage
free -h  # Memory usage
```

---

## 🆘 Troubleshooting

### Application won't start
```bash
cd /var/www/curbe
pm2 logs curbe --lines 200
npm run build  # Try rebuilding
pm2 restart curbe
```

### Database connection errors
```bash
# Test connection
psql -h 74.208.158.174 -p 5432 -U curbeapp -d curbe

# Check if database is running
sudo systemctl status postgresql
```

### Nginx 502 Bad Gateway
```bash
# Check if app is running
pm2 status

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log
```

### Out of disk space
```bash
# Check disk usage
df -h

# Clean npm cache
npm cache clean --force

# Remove old PM2 logs
pm2 flush
```

---

## 📞 Support

- **Production URL:** https://app.curbe.io
- **Repository:** https://github.com/cobertis/NewCurbeIO
- **Admin Email:** admin@prolinkhealth.com
