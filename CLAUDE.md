# CLAUDE.md — FromNorth Dashboard

Este archivo es el contexto principal para el agente de Claude Code. Leelo completo antes de hacer cualquier cambio.

---

## Repositorio

- **GitHub:** `facuguz55/fromnorthgbrp`
- **URL producción:** `https://fromnorthgbrp-faccus-projects.vercel.app`
- **Rama principal:** `main`

---

## Git — IMPORTANTE

Siempre que hagas commits en este repo usá este email:

```
git config user.email "facuiguzman1@gmail.com"
git config user.name "facuguz55"
```

**Nunca** commitees con `facuguz55@gmail.com` — Vercel bloquea el deploy porque no reconoce ese email como colaborador del proyecto. El email correcto es **facuiguzman1@gmail.com**.

---

## Deploy

El proyecto se deployea en Vercel bajo el equipo `faccus-projects`.  
Vercel tiene auto-deploy activado desde GitHub — cada push a `main` trigerea un deploy automático.  
Para deploy manual: `vercel --prod` (ya está linkeado en `.vercel/project.json`).

El build command es `tsc -b && vite build` y el output directory es `dist/`.  
Si Vercel no detecta el framework automáticamente, agregar al `vercel.json`:
```json
"buildCommand": "npm run build",
"outputDirectory": "dist"
```

---

## Stack

- **Frontend:** React 19 + TypeScript + Vite 8
- **Routing:** React Router v7
- **UI:** Lucide React, Recharts
- **Backend:** Vercel Serverless Functions (TypeScript) en `/api/`
- **Base de datos:** Supabase (PostgreSQL)
- **Tienda:** TiendaNube API
- **IA:** Claude API (Anthropic) con streaming SSE

---

## Cómo funciona el dashboard

### Fuente de datos principal
Todos los datos de ventas vienen de la **API de TiendaNube**. El servicio principal es `src/services/tiendanubeService.ts`.

El flujo es:
1. Al cargar, se intenta leer desde Supabase (`tn_orders_cache`, fila `id='main'`) para evitar llamadas a TiendaNube.
2. En paralelo se llama a `/api/sync-metrics` que sincroniza TiendaNube → Supabase.
3. Después de la sync, se limpia el cache y se refrescan los datos.
4. Los datos también se persisten en `localStorage` con TTL de 30 minutos.

### Cálculo de ventas — REGLA CRÍTICA
**Solo se cuentan órdenes con `payment_status === 'paid'` o `payment_status === 'authorized'`.**  
Las órdenes pendientes, sin pagar, reembolsadas y anuladas **NO se suman**.  
Esto aplica tanto al dashboard como al agente de IA.  
El período de análisis es los últimos **90 días**.

### Métricas del Dashboard (`src/pages/Dashboard.tsx`)
- **Ventas Totales (90d):** suma de todas las órdenes paid/authorized de los últimos 90 días → `metrics.totalFacturado`
- **Ventas Hoy:** órdenes paid/authorized desde las 00:00 hora Argentina → `metrics.ventasHoy`
- **Ventas Semana:** desde el lunes 00:00 hora Argentina → `metrics.ventasSemana`
- Timezone siempre: `America/Argentina/Buenos_Aires` (UTC-3)

### Agente IA (`api/ai-chat.ts`)
- Usa **Claude API** con streaming SSE
- Tiene tools para: consultar órdenes, productos, clientes, stock, cupones, Meta Ads, emails, ruleta
- El system prompt le dice qué puede y no puede hacer
- **IMPORTANTE:** cuando el agente calcula ventas, también debe filtrar solo `paid` y `authorized`, igual que el dashboard

---

## Estructura del proyecto

```
/api/
  ai-chat.ts          ← Agente IA con Claude API + tools de TiendaNube
  sync-metrics.ts     ← Sincroniza órdenes TiendaNube → Supabase
  tiendanube.ts       ← Proxy para llamadas a TiendaNube (evita CORS)
  tn-webhook.ts       ← Webhook de eventos de TiendaNube

/src/
  pages/
    Dashboard.tsx     ← Métricas principales (ventas, clientes, productos)
    Analytics.tsx     ← Gráficos y análisis profundo
    Ventas.tsx        ← Listado de órdenes
    Stock.tsx         ← Gestión de stock
    Clientes.tsx      ← Lista de clientes
    Cupones.tsx       ← Gestión de cupones TiendaNube
    Meta.tsx          ← Meta Ads (Facebook/Instagram)
    Mails.tsx         ← Bandeja de emails
    Ruleta.tsx        ← Ruleta de premios
    Settings.tsx      ← Config: StoreID + Token TiendaNube, Google Sheets URL
    Calendar.tsx      ← Calendario de ventas
    Tienda.tsx        ← Vista tienda
    Workflows.tsx     ← Automatizaciones n8n
    Instagram.tsx     ← Instagram
    Alerts.tsx        ← Alertas
  services/
    tiendanubeService.ts  ← Toda la lógica de fetch + cálculo de métricas
    supabaseService.ts    ← Acceso a Supabase
    dataService.ts        ← Settings locales (localStorage)
    metaAdsService.ts     ← Meta Ads API
    instagramService.ts   ← Instagram API
  components/
    AiChat.tsx        ← Chat flotante con el agente IA
    MetricCard.tsx    ← Card de métrica reutilizable
    SalesChart.tsx    ← Gráfico de ventas por día
    ...
```

---

## Negocio

- **Marca:** FromNorth — indumentaria argentina
- **Dueño:** Enzo Agustín Ribot (`enzoribot02@gmail.com`)
- **Ciudad:** Santa Fe Capital, Argentina
- **Tienda online:** `fromnorth.store`
- **Envíos:** Andreani

---

## Supabase

- **URL:** `https://tnmmbfcbviowhunnrzix.supabase.co`
- Tablas relevantes:
  - `tn_orders_cache` — cache de órdenes (fila `id='main'`, campo `orders` JSON)
  - `dashboard_chat_memory` — memoria persistente del agente IA
  - `ruleta_girada` — registros de giros de la ruleta de premios

---

## Reglas generales

- No agregar comentarios innecesarios al código
- No crear archivos nuevos si se puede editar uno existente
- Siempre verificar el email del git config antes de commitear
- El deploy es automático via GitHub → Vercel, no hace falta `vercel --prod` salvo urgencia
