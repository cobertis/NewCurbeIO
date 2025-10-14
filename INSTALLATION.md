# 📦 Guía de Instalación - Curbe Admin Dashboard

Esta guía te ayudará a instalar y configurar el sistema completo en tu propio servidor.

---

## 📋 Requisitos Previos

### Software Necesario
- **Node.js** v20.x o superior
- **PostgreSQL** v14.x o superior
- **npm** v10.x o superior

### Servicios Externos (Necesarios)
- **Cuenta de email SMTP** (Gmail, SendGrid, Mailgun, etc.)
- **Cuenta Twilio** (para SMS 2FA) - [Crear cuenta](https://www.twilio.com/try-twilio)
- **Cuenta Stripe** (para pagos) - [Crear cuenta](https://dashboard.stripe.com/register)

---

## 🚀 Pasos de Instalación

### 1. Clonar el Repositorio

```bash
git clone <tu-repositorio>
cd curbe-admin-dashboard
```

### 2. Instalar Dependencias

```bash
npm install
```

**Paquetes principales instalados:**
- Express.js (backend)
- React 18 + Vite (frontend)
- Drizzle ORM (base de datos)
- Stripe, Twilio, Nodemailer (servicios)
- Shadcn/ui + Tailwind CSS (interfaz)

### 3. Configurar Base de Datos PostgreSQL

#### Opción A: PostgreSQL Local

```bash
# Instalar PostgreSQL (Ubuntu/Debian)
sudo apt update
sudo apt install postgresql postgresql-contrib

# Crear base de datos
sudo -u postgres psql
CREATE DATABASE curbe_admin;
CREATE USER curbe_user WITH PASSWORD 'tu_password_seguro';
GRANT ALL PRIVILEGES ON DATABASE curbe_admin TO curbe_user;
\q
```

#### Opción B: Base de Datos en la Nube (Recomendado)

Usa un servicio como:
- **Neon** - [https://neon.tech](https://neon.tech) (Gratis para empezar)
- **Supabase** - [https://supabase.com](https://supabase.com)
- **Railway** - [https://railway.app](https://railway.app)

---

## 🔑 Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto:

```bash
# ==================== BASE DE DATOS ====================
DATABASE_URL="postgresql://usuario:password@localhost:5432/curbe_admin"

# ==================== SESIÓN ====================
SESSION_SECRET="genera-un-string-aleatorio-seguro-de-al-menos-32-caracteres"

# ==================== SMTP / EMAIL ====================
SMTP_HOST="smtp.gmail.com"              # Para Gmail
SMTP_PORT="587"                          # Puerto TLS
SMTP_USER="tu-email@gmail.com"          # Tu email
SMTP_PASSWORD="tu-app-password"         # Contraseña de aplicación
SMTP_FROM_EMAIL="noreply@curbe.io"      # Email remitente
SMTP_FROM_NAME="Curbe Admin"            # Nombre remitente

# ==================== TWILIO (SMS) ====================
TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxx"    # Tu Account SID
TWILIO_AUTH_TOKEN="tu-auth-token"       # Tu Auth Token
TWILIO_PHONE_NUMBER="+1234567890"       # Tu número Twilio

# ==================== STRIPE (PAGOS) ====================
STRIPE_SECRET_KEY="sk_test_xxxxx"              # Clave secreta (backend)
VITE_STRIPE_PUBLIC_KEY="pk_test_xxxxx"         # Clave pública (frontend)

# Claves de prueba para testing automatizado
TESTING_STRIPE_SECRET_KEY="sk_test_xxxxx"
TESTING_VITE_STRIPE_PUBLIC_KEY="pk_test_xxxxx"

# ==================== SERVIDOR ====================
PORT="5000"                              # Puerto del servidor
NODE_ENV="production"                    # Modo producción
```

---

## 📧 Configuración de Servicios Externos

### 1. Configurar Gmail para SMTP

1. Ir a tu cuenta de Google
2. Activar **verificación en 2 pasos**
3. Crear una **Contraseña de Aplicación**:
   - Ve a: https://myaccount.google.com/apppasswords
   - Selecciona "Correo" y "Otro dispositivo"
   - Copia la contraseña generada
   - Úsala en `SMTP_PASSWORD`

**Alternativas a Gmail:**
- **SendGrid** - [https://sendgrid.com](https://sendgrid.com)
- **Mailgun** - [https://www.mailgun.com](https://www.mailgun.com)
- **AWS SES** - [https://aws.amazon.com/ses](https://aws.amazon.com/ses)

### 2. Configurar Twilio (SMS)

1. Crear cuenta en [https://www.twilio.com/try-twilio](https://www.twilio.com/try-twilio)
2. Obtener tus credenciales:
   - **Account SID** → `TWILIO_ACCOUNT_SID`
   - **Auth Token** → `TWILIO_AUTH_TOKEN`
3. Comprar un número de teléfono:
   - Ir a "Phone Numbers" → "Buy a Number"
   - Seleccionar un número con capacidad SMS
   - Usar en `TWILIO_PHONE_NUMBER`

### 3. Configurar Stripe (Pagos)

1. Crear cuenta en [https://dashboard.stripe.com/register](https://dashboard.stripe.com/register)
2. Obtener claves API:
   - Ir a "Developers" → "API Keys"
   - **Secret key** → `STRIPE_SECRET_KEY`
   - **Publishable key** → `VITE_STRIPE_PUBLIC_KEY`

**Nota:** Usa las claves de **Test** primero para probar

---

## 🗄️ Migración de Base de Datos

Ejecuta las migraciones para crear las tablas:

```bash
npm run db:push
```

Si hay problemas, fuerza la sincronización:

```bash
npm run db:push -- --force
```

**Tablas creadas:**
- `companies` - Empresas/organizaciones
- `users` - Usuarios del sistema
- `otp_codes` - Códigos 2FA
- `trusted_devices` - Dispositivos confiables
- `activation_tokens` - Tokens de activación
- `plans` - Planes de suscripción
- `subscriptions` - Suscripciones activas
- `invoices` - Facturas
- `payments` - Pagos
- `features` - Funcionalidades del sistema
- `company_features` - Relación empresa-funcionalidad
- `activity_logs` - Logs de auditoría
- `email_templates` - Plantillas de email

---

## 🏗️ Construcción del Proyecto

### Modo Desarrollo

```bash
npm run dev
```

El servidor estará disponible en: **http://localhost:5000**

### Modo Producción

1. **Compilar el proyecto:**

```bash
npm run build
```

2. **Iniciar el servidor:**

```bash
npm start
```

---

## 👤 Crear Usuario Superadmin

**Opción 1: SQL Directo**

```sql
-- Conectar a la base de datos
psql postgresql://usuario:password@localhost:5432/curbe_admin

-- Crear superadmin (reemplaza con tus datos)
INSERT INTO users (
  id,
  email,
  password,
  "firstName",
  "lastName",
  role,
  "isActive",
  "emailVerified",
  "createdAt",
  "updatedAt"
) VALUES (
  gen_random_uuid(),
  'admin@curbe.io',
  '$2b$10$tu-hash-bcrypt-aqui',  -- Ver nota abajo
  'Super',
  'Admin',
  'superadmin',
  true,
  true,
  NOW(),
  NOW()
);
```

**Para generar el hash de la contraseña:**

```javascript
// Ejecuta esto en Node.js
const bcrypt = require('bcrypt');
const password = 'TuContraseñaSegura123!';
bcrypt.hash(password, 10).then(hash => console.log(hash));
```

**Opción 2: Desde la Aplicación**

1. Crear una empresa desde el código
2. El sistema creará un admin automáticamente
3. Cambiar el rol del admin a `superadmin` en la base de datos

---

## 🔒 Seguridad en Producción

### 1. Configurar HTTPS

Usa un proxy reverso como **Nginx** o **Caddy**:

```nginx
# Ejemplo Nginx
server {
    listen 80;
    server_name tu-dominio.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tu-dominio.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 2. Variables de Entorno Seguras

- ✅ **NUNCA** subas el archivo `.env` a Git
- ✅ Usa variables de entorno del servidor
- ✅ Rota las claves API periódicamente

### 3. Firewall y Puertos

```bash
# UFW (Ubuntu)
sudo ufw allow 22        # SSH
sudo ufw allow 80        # HTTP
sudo ufw allow 443       # HTTPS
sudo ufw enable
```

---

## 📊 Monitoreo y Logs

### Ver Logs de la Aplicación

```bash
# Con PM2 (recomendado)
pm2 logs curbe-admin

# Con systemd
journalctl -u curbe-admin -f
```

### Configurar PM2 (Gestor de Procesos)

```bash
# Instalar PM2
npm install -g pm2

# Iniciar aplicación
pm2 start npm --name "curbe-admin" -- start

# Auto-inicio en reinicio del servidor
pm2 startup
pm2 save

# Ver estado
pm2 status
pm2 monit
```

---

## 🐛 Solución de Problemas

### Error: "Cannot connect to database"

```bash
# Verificar que PostgreSQL está corriendo
sudo systemctl status postgresql

# Verificar conexión
psql $DATABASE_URL
```

### Error: "Email not sending"

- Verifica credenciales SMTP en `.env`
- Prueba el endpoint: `POST /api/email/send-test`
- Revisa logs del servidor

### Error: "Stripe webhook failed"

- Configura el webhook en Stripe Dashboard
- URL: `https://tu-dominio.com/api/stripe/webhooks`
- Copia el signing secret

---

## 📚 Recursos Adicionales

- **Documentación del Proyecto:** Ver `replit.md`
- **Stripe Docs:** [https://stripe.com/docs](https://stripe.com/docs)
- **Twilio Docs:** [https://www.twilio.com/docs](https://www.twilio.com/docs)
- **Drizzle ORM:** [https://orm.drizzle.team](https://orm.drizzle.team)

---

## 🆘 Soporte

Si tienes problemas con la instalación:

1. Revisa los logs del servidor
2. Verifica todas las variables de entorno
3. Confirma que todos los servicios externos están configurados
4. Revisa que la base de datos esté sincronizada

---

## ✅ Checklist Final

Antes de poner en producción:

- [ ] Base de datos configurada y migrada
- [ ] Todas las variables de entorno establecidas
- [ ] SMTP configurado y probado
- [ ] Twilio configurado (SMS funcionando)
- [ ] Stripe configurado (webhooks activos)
- [ ] HTTPS habilitado
- [ ] Firewall configurado
- [ ] Superadmin creado
- [ ] PM2 o systemd configurado
- [ ] Backups de base de datos programados

---

**¡Tu sistema Curbe Admin Dashboard está listo! 🚀**
