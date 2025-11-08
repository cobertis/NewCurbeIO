# 🚀 Guía Completa de Deployment - Curbe.io

Esta guía te muestra cómo subir cambios desde Replit a GitHub y luego actualizar tu servidor de producción.

---

## 📋 Configuración Inicial (Una sola vez)

### 1️⃣ Configurar Credenciales de GitHub en Replit

**⚠️ IMPORTANTE: Solo necesitas hacer esto UNA VEZ. Las credenciales se guardarán permanentemente.**

#### Paso A: Crear Token de GitHub

1. Ve a: **https://github.com/settings/tokens**
2. Click **"Generate new token (classic)"**
3. Nombre: `Replit Curbe Deployment`
4. Permisos:
   - ✅ `repo` (Full control)
   - ✅ `workflow` (Update workflows)
5. **COPIA EL TOKEN** (ejemplo: `ghp_xxxxxxxxxxxx...`)

#### Paso B: Agregar Secret en Replit

1. En Replit, abre **"Secrets"** (icono de candado 🔒 en la barra lateral)
2. Click **"New Secret"**
3. Configura:
   ```
   Key:   GIT_URL
   Value: https://cobertis:TU_TOKEN_AQUI@github.com/cobertis/NewCurbeIO
   ```
   
   **Ejemplo real:**
   ```
   https://cobertis:ghp_1234567890abcdefghijklmnopqrstuvwxyz@github.com/cobertis/NewCurbeIO
   ```

4. Click **"Add Secret"**

✅ **¡Listo! Nunca más tendrás que volver a ingresar credenciales.**

---

## 🔄 Workflow de Desarrollo

### Opción 1: Commit + Push en un solo comando (Recomendado)

```bash
./git-commit-push.sh "Tu mensaje descriptivo aquí"
```

**Ejemplos:**
```bash
./git-commit-push.sh "fix: corrección de bug en avatar upload"
./git-commit-push.sh "feat: nuevo módulo de reportes"
./git-commit-push.sh "docs: actualización de documentación"
```

### Opción 2: Paso por paso

```bash
# 1. Ver cambios
git status

# 2. Agregar archivos
git add -A

# 3. Hacer commit
git commit -m "Tu mensaje"

# 4. Push a GitHub
./git-push.sh
```

### Opción 3: Solo Pull (traer cambios del servidor)

```bash
./git-pull.sh
```

---

## 🌐 Actualizar Servidor de Producción

### Método 1: Deployment Completo (Recomendado)

Usa este método cuando:
- Instalaste nuevos paquetes npm
- Modificaste el schema de la base de datos
- Es una actualización importante

```bash
# 1. SSH al servidor
ssh root@app.curbe.io

# 2. Ejecutar deployment script
cd /var/www/curbe
./deploy.sh
```

**Qué hace el script:**
- ✅ Crea backup de .env
- ✅ Descarga últimos cambios de GitHub
- ✅ Instala dependencias nuevas
- ✅ Corre migraciones de base de datos
- ✅ Compila el código
- ✅ Reinicia la aplicación
- ✅ Muestra estado final

### Método 2: Quick Update (Rápido)

Usa este método cuando:
- Solo cambiaste código (sin nuevas dependencias)
- Es un fix menor o cambio de texto

```bash
# 1. SSH al servidor
ssh root@app.curbe.io

# 2. Quick update
cd /var/www/curbe
./quick-update.sh
```

**Qué hace:**
- ✅ Descarga últimos cambios
- ✅ Reinicia la aplicación
- ⚡ Toma ~10 segundos

---

## ✅ Checklist Completo de Deployment

### En Replit (Desarrollo):

- [ ] Probaste los cambios localmente
- [ ] Verificaste que no hay errores en consola
- [ ] Commit y push a GitHub:
  ```bash
  ./git-commit-push.sh "descripción de cambios"
  ```
- [ ] Verificaste en GitHub que los cambios están:
  https://github.com/cobertis/NewCurbeIO/commits/main

### En Servidor (Producción):

- [ ] Conectaste por SSH: `ssh root@app.curbe.io`
- [ ] Navegaste al directorio: `cd /var/www/curbe`
- [ ] Ejecutaste deployment:
  - Completo: `./deploy.sh`
  - Rápido: `./quick-update.sh`
- [ ] Verificaste que la app está corriendo: `pm2 status`
- [ ] Probaste en el navegador: https://app.curbe.io

---

## 🛠️ Comandos Útiles

### En Replit:

```bash
# Ver estado de Git
git status

# Ver últimos commits
git log --oneline -10

# Ver diferencias antes de commit
git diff

# Descartar cambios locales
git checkout .

# Ver archivos que cambiarán
git status --short
```

### En el Servidor:

```bash
# Ver logs de la aplicación
pm2 logs curbe

# Ver últimas 100 líneas de logs
pm2 logs curbe --lines 100

# Monitoreo en tiempo real
pm2 monit

# Reiniciar manualmente
pm2 restart curbe

# Ver estado
pm2 status

# Ver info detallada
pm2 info curbe
```

---

## 🐛 Troubleshooting

### "Error: GIT_URL secret not configured"

**Solución:**
1. Verifica que creaste el secret en Replit
2. El nombre debe ser exactamente: `GIT_URL` (mayúsculas)
3. El formato debe ser: `https://username:token@github.com/org/repo`

### "Permission denied" al ejecutar scripts

**Solución:**
```bash
chmod +x *.sh
chmod +x git-*.sh
```

### "remote: Invalid username or password"

**Solución:**
1. Tu token de GitHub expiró o es inválido
2. Genera un nuevo token: https://github.com/settings/tokens
3. Actualiza el secret `GIT_URL` en Replit

### Servidor no se actualiza después de deployment

**Solución:**
```bash
# En el servidor
cd /var/www/curbe
git pull origin main
pm2 restart curbe
pm2 logs curbe
```

### Aplicación muestra 502 Bad Gateway

**Solución:**
```bash
# Verificar si la app está corriendo
pm2 status

# Si no está corriendo, iniciarla
pm2 start ecosystem.config.cjs --env production

# Ver logs de error
pm2 logs curbe --err --lines 50
```

---

## 📂 Estructura de Scripts

```
/
├── git-commit-push.sh      # Commit + Push en un solo comando
├── git-push.sh             # Solo push
├── git-pull.sh             # Solo pull
├── deploy.sh               # Script completo de deployment (para servidor)
├── quick-update.sh         # Update rápido (para servidor)
├── GITHUB_SETUP.md         # Setup detallado de GitHub
├── SERVER_DEPLOYMENT.md    # Documentación del servidor
└── DEPLOYMENT_GUIDE.md     # Esta guía
```

---

## 🔗 URLs Importantes

- **App Producción:** https://app.curbe.io
- **Repositorio GitHub:** https://github.com/cobertis/NewCurbeIO
- **Commits:** https://github.com/cobertis/NewCurbeIO/commits/main
- **GitHub Tokens:** https://github.com/settings/tokens
- **Replit Secrets:** Panel de Secrets en Replit (icono 🔒)

---

## 📞 Flujo Completo de Ejemplo

```bash
# ==========================================
# EN REPLIT (Desarrollo)
# ==========================================

# 1. Hacer cambios en el código
# ... editar archivos ...

# 2. Commit y push
./git-commit-push.sh "feat: agregado módulo de reportes"

# ==========================================
# EN SERVIDOR (Producción)
# ==========================================

# 3. Conectar por SSH
ssh root@app.curbe.io

# 4. Navegar a la app
cd /var/www/curbe

# 5. Deployment completo
./deploy.sh

# 6. Verificar
pm2 status

# 7. Probar en navegador
# https://app.curbe.io
```

---

## 🎯 Tips Pro

1. **Commits frecuentes:** Haz commits pequeños y descriptivos
2. **Mensajes claros:** Usa prefijos: `feat:`, `fix:`, `docs:`, `refactor:`
3. **Prueba localmente:** Siempre prueba en Replit antes de subir
4. **Backup automático:** `deploy.sh` hace backup de .env automáticamente
5. **Logs son tu amigo:** `pm2 logs curbe` te muestra todo lo que pasa

---

## ⚠️ Notas de Seguridad

- ✅ **NUNCA** compartas tu token de GitHub
- ✅ **NUNCA** hagas commit del archivo `.env`
- ✅ **NUNCA** expongas secretos en el código
- ✅ El `.gitignore` ya está configurado correctamente
- ✅ Los secrets de Replit son seguros y cifrados

---

**¿Preguntas? Revisa:**
- `GITHUB_SETUP.md` - Setup de credenciales
- `SERVER_DEPLOYMENT.md` - Operaciones del servidor
- Esta guía - Workflow completo
