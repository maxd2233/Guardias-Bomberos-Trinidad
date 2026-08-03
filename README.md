# Guardia Bomberos La Trinidad

Tablero de guardias para Bomberos Voluntarios La Trinidad (Tucumán). Los bomberos se
anotan por número de ingreso, el tablero muestra **siempre dos semanas calendario**
(la semana actual + la siguiente), hay historial de movimientos con Realtime y un panel
de administración para oficiales.

## Stack

- [Next.js 16](https://nextjs.org) (App Router, React 19, TypeScript, Tailwind CSS v4)
- [Supabase](https://supabase.com) (Postgres + RLS + Realtime)
- [Vercel](https://vercel.com) (hosting + Cron Jobs)

## Variables de entorno

Todas están documentadas en `.env.local.example`. Copialo a `.env.local` para desarrollo
y configurá las mismas variables en Vercel para producción.

| Variable                        | Secreta | Dónde se obtiene                                                                 |
| ------------------------------- | ------- | -------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | No      | Supabase → Settings → API → **Project URL**                                      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No      | Supabase → Settings → API → **anon / public key**                                |
| `SUPABASE_SERVICE_ROLE_KEY`     | **Sí**  | Supabase → Settings → API → **service_role secret**                              |
| `SESSION_SECRET`                | **Sí**  | Generala vos (mínimo 32 caracteres). Firma el JWT de la cookie de sesión         |
| `CRON_SECRET`                   | **Sí**  | Generala vos (mínimo 16 caracteres). Protege el endpoint del cron                 |

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` y `SESSION_SECRET` solo se usan en el servidor.
> **Nunca** deben exponerse al navegador. `SUPABASE_SERVICE_ROLE_KEY` debe empezar con
> `sb_secret_` (si empieza con `sb_publishable_` es la anon key, no sirve aquí).

Para generar los dos secretos:

```bash
# SESSION_SECRET (base64, 32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# CRON_SECRET (hex, 32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 1. Crear el proyecto en Supabase

1. Entrá a https://supabase.com → **New project**.
2. Nombre, contraseña de la base y elegí la región más cercana a Tucumán
   (recomendado: **South America (São Paulo)** = `sa-east-1`).
3. En el dashboard, andá a **SQL Editor** (menú izquierdo).
4. Ejecutá los scripts **en este orden** (los dos son seguros de re-ejecutar):
   - Abrí `supabase/schema.sql`, pegá el contenido y hacé clic en **Run**.
   - Abrí `supabase/rpc.sql`, pegá el contenido y hacé clic en **Run**.

   `schema.sql` crea las tablas, índices y políticas RLS. `rpc.sql` crea las funciones
   que el servidor usa para anotar/cancelar/cambiar turnos, la generación de la ventana
   y publica las tablas en Realtime.
5. Andá a **Settings → API** y copiá los tres valores:
   - `Project URL`
   - `anon public key`
   - `service_role secret`

## 2. Cargar los primeros bomberos

Necesitás cargar el padrón antes de que alguien pueda entrar. Dos opciones:

**Opción A — Script de seed (recomendado para la primera carga):**

Abrí `supabase/seed.sql`, reemplazá los nombres de ejemplo por los reales y ejecutalo en
el SQL Editor. **Debe existir al menos un bombero con cargo `Oficial Principal`** para
acceder al panel `/admin`.

**Opción B — Panel de administración:**

Una vez desplegado, entrá con un bombero que tenga cargo `Oficial Principal` y usá
**Administración** en la barra de navegación para dar de alta al resto.

> Sin al menos un `Oficial Principal` cargado, nadie puede llegar al panel de admin
> (el login valida contra `bomberos` y `/admin` solo admite oficiales). Por eso en la
> primera carga conviene usar el seed.

## 3. Conectar el repo de GitHub a Vercel

Si todavía no existe un repo, inicializalo:

```bash
git init
git add .
git commit -m "Inicial"
git branch -M main
git remote add origin https://github.com/<TU_USUARIO>/<NOMBRE_REPO>.git
git push -u origin main
```

Después:

1. Entrá a https://vercel.com → **Add New → Project**.
2. Elegí **Import** sobre tu repositorio de GitHub (Vercel te pide autorizar la cuenta).
3. Vercel detecta **Next.js** solo (framework y preset automáticos). No cambies nada.
4. Antes de **Deploy**, expandí **Environment Variables** y agregá las cinco variables de
   la tabla de arriba (marca **Production**).
5. Hacé clic en **Deploy**. Cada `git push` a `main` redeploya automáticamente.

## 4. Configurar el CRON_SECRET

El cron es el que garantiza que el tablero siempre tenga las dos semanas de celdas
generadas. Está definido en `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/generar-turnos", "schedule": "5 3 * * *" }
  ]
}
```

- El horario está en **UTC**: `5 3 * * *` = 03:05 UTC = **00:05 hora Argentina** (UTC-3).
  Argentina no usa horario de verano, así que siempre es 00:05.
- **Los cron jobs solo corren en deployments de producción** (no en previews ni en local).
- En el plan **Hobby** de Vercel, los crons se ejecutan una vez por día.
- Para que Vercel envíe el `CRON_SECRET` como `Authorization: Bearer <CRON_SECRET>`,
  activá **Settings → Cron Jobs → Protect cron jobs** en el proyecto de Vercel. Si queda
  desactivado, el endpoint responde 401 (por diseño).

Para verificar el cron manualmente después del deploy:

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" https://<TU_PROYECTO>.vercel.app/api/cron/generar-turnos
```

Respuesta esperada (primera vez): `{"ok":true,"fecha_inicio":"YYYY-MM-DD","dias":14,"turnos_creados":56}`.
En corridas siguientes `turnos_creados` baja a `0` o menos porque las celdas ya existen.

---

## Puesta en marcha local

```bash
npm install
copy .env.local.example .env.local   # y completá los valores
npm run dev
```

Abrí http://localhost:3000.

## Comandos útiles

```bash
npm run dev     # servidor de desarrollo
npm run lint    # eslint
npm run build   # build de producción
npm run start   # sirve el build de producción (local)
```

## Uso

- **Login:** con el número de ingreso (sin contraseña). En la pantalla de login se
  muestra el padrón para quienes no recuerden su número.
- **Tablero (`/`):** dos semanas calendario; los días pasados de la semana actual se
  ven atenuados (no se puede anotar en el pasado). Una persona por turno; el único
  conflicto posible (dos pedidos a la vez sobre la misma celda) lo resuelve la base.
- **Historial (`/historial`):** log de anotaciones, cancelaciones y cambios, con
  Realtime.
- **Administración (`/admin`):** alta y baja de bomberos. Solo `Oficial Principal` y
  `Oficial Ayudante`.
