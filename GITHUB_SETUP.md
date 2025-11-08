# 🔐 GitHub Setup - Credenciales Persistentes en Replit

## ⚡ Configuración Rápida (Una sola vez)

### Paso 1: Crear Personal Access Token en GitHub

1. Ve a: **https://github.com/settings/tokens**
2. Click en **"Generate new token (classic)"**
3. Dale un nombre: `Replit Curbe Deployment`
4. Selecciona los permisos:
   - ✅ `repo` (Full control of private repositories)
   - ✅ `workflow` (Update GitHub Action workflows)
5. Click en **"Generate token"**
6. **COPIA EL TOKEN** (lo necesitarás en el siguiente paso, no lo verás de nuevo)

---

### Paso 2: Configurar Secreto en Replit

1. En Replit, abre el panel de **"Secrets"** (icono de candado en la barra lateral izquierda)
2. Click en **"New Secret"**
3. Configura:
   - **Key:** `GIT_URL`
   - **Value:** `https://cobertis:<TU_TOKEN_AQUI>@github.com/cobertis/NewCurbeIO`
   
   **Ejemplo:**
   ```
   https://cobertis:ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx@github.com/cobertis/NewCurbeIO
   ```

4. Click **"Add Secret"**

**NOTA IMPORTANTE:** Reemplaza `<TU_TOKEN_AQUI>` con el token que copiaste en el Paso 1.

---

### Paso 3: Usar los Scripts de Git

Una vez configurado el secreto, puedes usar estos comandos:

#### Para hacer COMMIT y PUSH:
```bash
./git-commit-push.sh "Tu mensaje de commit aquí"
```

#### Para solo hacer PUSH (si ya hiciste commit):
```bash
./git-push.sh
```

#### Para sincronizar cambios del servidor (PULL):
```bash
./git-pull.sh
```

---

## 🚀 Comandos Disponibles

### Commit + Push en un solo comando
```bash
./git-commit-push.sh "fix: corrección de errores en avatar"
```

### Solo Push
```bash
./git-push.sh
```

### Solo Pull
```bash
./git-pull.sh
```

### Ver estado de Git
```bash
git status
```

### Ver historial de commits
```bash
git log --oneline -10
```

---

## ✅ Verificar que Todo Funciona

```bash
# 1. Ver archivos modificados
git status

# 2. Hacer commit y push
./git-commit-push.sh "test: verificar configuración de Git"

# 3. Verificar en GitHub
# Ve a: https://github.com/cobertis/NewCurbeIO/commits/main
```

---

## 🔧 Troubleshooting

### Error: "remote: Invalid username or password"
- ✅ Verifica que el secreto `GIT_URL` esté configurado correctamente
- ✅ Verifica que el token de GitHub sea válido
- ✅ Asegúrate de que el token tenga permisos `repo`

### Error: "Permission denied"
- ✅ Los scripts necesitan permisos de ejecución
- ✅ Corre: `chmod +x git-*.sh`

### El secreto no se carga
- ✅ Reinicia el workspace de Replit
- ✅ Verifica que el nombre del secreto sea exactamente `GIT_URL` (mayúsculas)

---

## 📝 Notas Importantes

1. **Nunca compartas tu token de GitHub** - Es como tu contraseña
2. **El secreto se guarda en Replit** - No necesitas volver a configurarlo
3. **Los tokens expiran** - Si GitHub te pide renovarlo, genera uno nuevo y actualiza el secreto
4. **Usa HTTPS, no SSH** - Replit trabaja mejor con HTTPS para Git

---

## 🎯 Workflow Recomendado

```bash
# 1. Hacer cambios en el código
# ... editar archivos ...

# 2. Ver qué cambió
git status

# 3. Commit y push
./git-commit-push.sh "feat: nueva funcionalidad X"

# 4. Actualizar servidor de producción
# (Conéctate por SSH a tu servidor)
ssh root@app.curbe.io
cd /var/www/curbe
./deploy.sh
```

---

## 🌐 URLs Importantes

- **Repositorio:** https://github.com/cobertis/NewCurbeIO
- **Tokens de GitHub:** https://github.com/settings/tokens
- **Commits:** https://github.com/cobertis/NewCurbeIO/commits/main
