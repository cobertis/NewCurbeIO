#!/bin/bash

# Git Credentials Setup for Production Server
# This script configures Git to remember credentials permanently on Ubuntu server

set -e

echo "🔐 Configurando Git en el Servidor de Producción"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Este script debe ejecutarse como root o con sudo"
    echo "Uso: sudo ./server-setup-git.sh"
    exit 1
fi

# Configure Git credential helper to store credentials permanently
echo ""
echo "1️⃣ Configurando Git credential helper..."
git config --global credential.helper store

# Configure Git user (for commits if needed)
echo ""
echo "2️⃣ Configurando usuario de Git..."
git config --global user.email "admin@prolinkhealth.com"
git config --global user.name "Curbe Admin"

# Create .git-credentials file location
CRED_FILE="/root/.git-credentials"

echo ""
echo "3️⃣ Configuración de credenciales..."
echo ""
echo "Ahora necesitas proporcionar tu token de GitHub."
echo ""
echo "📝 PASOS:"
echo "   1. Ve a: https://github.com/settings/tokens"
echo "   2. Click 'Generate new token (classic)'"
echo "   3. Marca el scope 'repo' ✅"
echo "   4. Copia el token (ejemplo: ghp_1234abcd...)"
echo ""
read -p "👉 Ingresa tu GitHub Personal Access Token: " GITHUB_TOKEN

if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ Token no puede estar vacío"
    exit 1
fi

# Save credentials
echo "https://cobertis:${GITHUB_TOKEN}@github.com" > "$CRED_FILE"
chmod 600 "$CRED_FILE"

echo ""
echo "✅ Credenciales guardadas en: $CRED_FILE"
echo "✅ Git está configurado para recordar credenciales permanentemente"
echo ""
echo "🧪 Probando configuración..."
cd /var/www/curbe
git pull origin main 2>&1 | head -5

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ ¡Configuración completada!"
echo ""
echo "Ahora puedes usar los scripts de deployment sin ingresar credenciales:"
echo "  - ./deploy.sh"
echo "  - ./quick-update.sh"
echo ""
echo "Las credenciales están guardadas de forma segura en:"
echo "  $CRED_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
