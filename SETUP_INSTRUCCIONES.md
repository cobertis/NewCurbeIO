# 🎯 INSTRUCCIONES RÁPIDAS - Setup Completo

## ⚡ Pasos para Configurar Git (Una Sola Vez)

### 1️⃣ Crear Token de GitHub (2 minutos)

1. Abre: **https://github.com/settings/tokens**
2. Click **"Generate new token (classic)"**
3. Configuración:
   - **Note (nombre):** `Replit Curbe Deployment`
   - **Expiration:** No expiration (o 1 año)
   - **Scopes:** Marca solo `repo` ✅
4. Click **"Generate token"** (botón verde al final)
5. **COPIA EL TOKEN** inmediatamente (se ve así: `ghp_1234abcd...`)
   - ⚠️ Solo lo verás UNA VEZ, guárdalo temporalmente

---

### 2️⃣ Agregar Secret en Replit (30 segundos)

1. En Replit, click en el icono de **candado 🔒** en la barra lateral izquierda (dice "Secrets")
2. Click en **"New Secret"** (botón azul)
3. Llena los campos:
   ```
   Key:   GIT_URL
   Value: https://cobertis:TU_TOKEN_AQUI@github.com/cobertis/NewCurbeIO
   ```
   
   **EJEMPLO REAL:**
   ```
   Si tu token es: ghp_1234567890abcdefghijklmnopqrstuvwxyz
   
   Entonces el Value completo será:
   https://cobertis:ghp_1234567890abcdefghijklmnopqrstuvwxyz@github.com/cobertis/NewCurbeIO
   ```

4. Click **"Add Secret"**
5. ✅ **¡LISTO!** Nunca más volverás a ingresar credenciales de GitHub

---

### 3️⃣ Subir Cambios a GitHub (5 segundos)

```bash
./git-commit-push.sh "fix: avatar upload funcionando"
```

Eso es todo. El script:
- Agrega todos los archivos
- Hace commit
- Hace push a GitHub
- Todo automático con las credenciales guardadas

---

## 🌐 Actualizar Servidor de Producción

### Opción A: Deployment Completo (Recomendado)
Usa esto cuando cambias schema, instalas paquetes, o es un cambio importante:

```bash
ssh root@app.curbe.io
cd /var/www/curbe
./deploy.sh
```

### Opción B: Quick Update (Rápido)
Usa esto para cambios de código simples:

```bash
ssh root@app.curbe.io
cd /var/www/curbe
./quick-update.sh
```

---

## ✅ Scripts Disponibles

### En Replit:
```bash
./git-commit-push.sh "mensaje"  # Commit + Push todo en uno
./git-push.sh                   # Solo push (si ya hiciste commit)
./git-pull.sh                   # Traer cambios del servidor
```

### En el Servidor:
```bash
./deploy.sh       # Deployment completo (backup, migrations, build, restart)
./quick-update.sh # Update rápido (pull + restart)
pm2 logs curbe    # Ver logs
pm2 status        # Ver estado de la app
```

---

## 📖 Documentación Completa

- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** - Guía completa de deployment
- **[GITHUB_SETUP.md](./GITHUB_SETUP.md)** - Setup detallado de Git
- **[SERVER_DEPLOYMENT.md](./SERVER_DEPLOYMENT.md)** - Operaciones del servidor

---

## 🔥 Flujo de Trabajo Diario

```bash
# 1. Hacer cambios en Replit
# ... editar código ...

# 2. Subir a GitHub (UN comando)
./git-commit-push.sh "feat: nueva funcionalidad"

# 3. SSH al servidor
ssh root@app.curbe.io

# 4. Actualizar producción (UN comando)
cd /var/www/curbe && ./deploy.sh

# ✅ LISTO - Ya está en producción
```

---

## 🆘 Troubleshooting

### "Error: GIT_URL secret not configured"
- Verifica que creaste el secret en Replit (icono de candado 🔒)
- El nombre debe ser exactamente: **GIT_URL** (mayúsculas)

### "remote: Invalid username or password"
- Tu token está mal copiado o expiró
- Genera uno nuevo y actualiza el secret GIT_URL

### "Permission denied" al ejecutar scripts
```bash
chmod +x *.sh
```

---

## 📞 URLs Importantes

- **Producción:** https://app.curbe.io
- **GitHub:** https://github.com/cobertis/NewCurbeIO
- **Tokens:** https://github.com/settings/tokens
