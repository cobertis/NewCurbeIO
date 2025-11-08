# 🔐 Configurar Git en el Servidor (Una Sola Vez)

Este documento explica cómo configurar Git en tu servidor de producción para que **nunca más te pida usuario y contraseña** cuando hagas `git pull`.

---

## ⚡ Opción 1: Script Automático (Recomendado)

### 1. Subir el script al servidor

Primero, sube el archivo `server-setup-git.sh` a tu servidor:

```bash
# Desde tu máquina local (o desde Replit)
scp server-setup-git.sh root@app.curbe.io:/var/www/curbe/
```

### 2. Ejecutar el script en el servidor

```bash
# Conectar por SSH
ssh root@app.curbe.io

# Navegar al directorio
cd /var/www/curbe

# Ejecutar el script (como root)
sudo ./server-setup-git.sh
```

El script te pedirá tu **GitHub Personal Access Token** una sola vez y lo guardará de forma segura.

### 3. ¡Listo!

Ahora puedes usar `./deploy.sh` o `./quick-update.sh` sin que te pida credenciales.

---

## ⚡ Opción 2: Configuración Manual

Si prefieres hacerlo manualmente, sigue estos pasos:

### Paso 1: Crear Token de GitHub

1. Ve a: **https://github.com/settings/tokens**
2. Click **"Generate new token (classic)"**
3. Nombre: `Server Production Curbe`
4. Scopes: Marca solo **`repo`** ✅
5. Click **"Generate token"**
6. **COPIA EL TOKEN** (ejemplo: `ghp_1234abcdef...`)

### Paso 2: Configurar Git en el Servidor

Conecta por SSH a tu servidor:

```bash
ssh root@app.curbe.io
```

Ejecuta estos comandos:

```bash
# 1. Configurar Git para guardar credenciales permanentemente
git config --global credential.helper store

# 2. Configurar usuario de Git
git config --global user.email "admin@prolinkhealth.com"
git config --global user.name "Curbe Admin"

# 3. Guardar credenciales (reemplaza TU_TOKEN con tu token real)
echo "https://cobertis:TU_TOKEN@github.com" > /root/.git-credentials
chmod 600 /root/.git-credentials
```

**Ejemplo real:**
```bash
echo "https://cobertis:ghp_1234abcdefghijklmnopqrstuvwxyz@github.com" > /root/.git-credentials
chmod 600 /root/.git-credentials
```

### Paso 3: Probar

```bash
cd /var/www/curbe
git pull origin main
```

**NO** debería pedir usuario ni contraseña.

---

## ✅ Verificar que Funciona

```bash
# En el servidor
cd /var/www/curbe

# Hacer un pull
git pull origin main
```

Si **NO** pide credenciales, ¡funciona! ✅

---

## 🔧 Troubleshooting

### "Authentication failed" después de configurar

**Solución:** El token es inválido o no tiene permisos `repo`. Genera un nuevo token y actualiza el archivo:

```bash
# Editar credenciales
nano /root/.git-credentials

# Contenido debe ser:
https://cobertis:TU_NUEVO_TOKEN@github.com

# Guardar (Ctrl+O, Enter, Ctrl+X)
```

### El archivo de credenciales no existe

```bash
# Verificar si existe
ls -la /root/.git-credentials

# Si no existe, crearlo
echo "https://cobertis:TU_TOKEN@github.com" > /root/.git-credentials
chmod 600 /root/.git-credentials
```

### Git sigue pidiendo credenciales

```bash
# Verificar configuración
git config --global credential.helper

# Debería mostrar: store

# Si no, configurar de nuevo
git config --global credential.helper store
```

---

## 📂 Archivos Importantes

### `/root/.git-credentials`
Contiene las credenciales de GitHub en formato:
```
https://cobertis:ghp_token@github.com
```

**⚠️ IMPORTANTE:** Este archivo tiene permisos `600` (solo root puede leer/escribir).

### `/root/.gitconfig`
Contiene la configuración de Git:
```ini
[credential]
    helper = store
[user]
    email = admin@prolinkhealth.com
    name = Curbe Admin
```

---

## 🚀 Usar Deployment Scripts

Una vez configurado, puedes usar:

### Deployment Completo
```bash
ssh root@app.curbe.io
cd /var/www/curbe
./deploy.sh
```

### Quick Update
```bash
ssh root@app.curbe.io
cd /var/www/curbe
./quick-update.sh
```

**Ninguno pedirá credenciales de GitHub.**

---

## 🔐 Seguridad

- ✅ Las credenciales están cifradas en el archivo con permisos `600`
- ✅ Solo el usuario `root` puede leer el archivo
- ✅ El token de GitHub puede revocarse en cualquier momento
- ✅ El token solo tiene permisos de `repo` (no acceso total)

---

## 🔄 Renovar Token

Si el token expira o quieres cambiarlo:

```bash
# 1. Generar nuevo token en GitHub
# https://github.com/settings/tokens

# 2. SSH al servidor
ssh root@app.curbe.io

# 3. Actualizar credenciales
echo "https://cobertis:NUEVO_TOKEN@github.com" > /root/.git-credentials

# 4. Probar
cd /var/www/curbe
git pull origin main
```

---

## 📞 URLs Útiles

- **GitHub Tokens:** https://github.com/settings/tokens
- **Repositorio:** https://github.com/cobertis/NewCurbeIO
- **Servidor:** app.curbe.io
