# 🚀 Instrucciones para Actualizar el Servidor

## ⚡ Primera Vez (Configurar Git - Solo Una Vez)

Antes de poder hacer `git pull` sin que pida credenciales, ejecuta esto **UNA SOLA VEZ**:

```bash
# 1. SSH al servidor
ssh root@app.curbe.io

# 2. Ir al directorio
cd /var/www/curbe

# 3. Hacer pull (te pedirá credenciales ESTA VEZ)
git pull origin main

# 4. Configurar Git para recordar credenciales
git config --global credential.helper store
git config --global user.email "admin@prolinkhealth.com"
git config --global user.name "Curbe Admin"

# 5. Hacer ejecutables los scripts
chmod +x *.sh

# 6. Ejecutar el script de configuración
./server-setup-git.sh
```

El script `server-setup-git.sh` te pedirá tu **GitHub Personal Access Token**:

1. Ve a: https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Marca solo: **`repo`** ✅
4. Copia el token y pégalo cuando el script te lo pida

**¡Listo!** Nunca más te pedirá credenciales.

---

## 🔄 Actualizar el Servidor (Cada Vez que Haya Cambios)

### Opción 1: Deployment Completo (Recomendado)
Usa esto cuando hay cambios importantes (nuevas dependencias, migraciones, etc.):

```bash
ssh root@app.curbe.io
cd /var/www/curbe
./deploy.sh
```

**Qué hace:**
- ✅ Backup de .env
- ✅ Git pull (sin pedir credenciales)
- ✅ npm install (si hay nuevas dependencias)
- ✅ Database migrations
- ✅ Build de la aplicación
- ✅ Restart con PM2
- ✅ Muestra el estado final

---

### Opción 2: Quick Update (Rápido)
Usa esto para cambios pequeños de código:

```bash
ssh root@app.curbe.io
cd /var/www/curbe
./quick-update.sh
```

**Qué hace:**
- ✅ Git pull (sin pedir credenciales)
- ✅ Restart con PM2
- ⚡ Toma ~10 segundos

---

## 📝 Comandos Útiles

### Ver logs de la aplicación
```bash
pm2 logs curbe
pm2 logs curbe --lines 100
```

### Ver estado
```bash
pm2 status
pm2 monit  # Monitoreo en tiempo real
```

### Reiniciar manualmente
```bash
pm2 restart curbe
```

### Ver último commit
```bash
git log -1
```

---

## 🆘 Si Algo Sale Mal

### Git pide credenciales de nuevo
```bash
# Ejecutar de nuevo el setup
cd /var/www/curbe
./server-setup-git.sh
```

### La aplicación no inicia
```bash
# Ver logs de error
pm2 logs curbe --err --lines 50

# Reiniciar
pm2 restart curbe

# Si sigue sin funcionar, deployment completo
./deploy.sh
```

### Base de datos no conecta
```bash
# Verificar que PostgreSQL está corriendo
sudo systemctl status postgresql

# Ver variables de entorno
cat /var/www/curbe/.env | grep DATABASE
```

---

## ✅ Workflow Completo

```
┌─────────────────────────────────────────┐
│  REPLIT (Desarrollo)                    │
│  - Hacer cambios                        │
│  - Replit sube automáticamente a GitHub │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  GITHUB                                 │
│  - Repositorio actualizado              │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  SERVIDOR (Producción)                  │
│  ssh root@app.curbe.io                  │
│  cd /var/www/curbe                      │
│  ./deploy.sh  (o ./quick-update.sh)     │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  APLICACIÓN ACTUALIZADA                 │
│  https://app.curbe.io                   │
└─────────────────────────────────────────┘
```

---

## 📞 Contacto

- **Servidor:** app.curbe.io
- **GitHub:** https://github.com/cobertis/NewCurbeIO
- **Email:** admin@prolinkhealth.com
