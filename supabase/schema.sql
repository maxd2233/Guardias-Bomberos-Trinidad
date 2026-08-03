-- ============================================================
-- Guardia Bomberos La Trinidad — Schema inicial
-- Stack: Supabase (Postgres + Auth)
-- Ejecutar en el SQL Editor del dashboard de Supabase.
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- Tabla: bomberos
-- ============================================================
create table if not exists public.bomberos (
  id              uuid primary key default gen_random_uuid(),
  numero_ingreso  integer not null unique,
  nombre_completo text    not null,
  cargo           text    not null check (
                    cargo in (
                      'Oficial Principal',
                      'Oficial Ayudante',
                      'Cabo',
                      'Bombero',
                      'Aspirante'
                    )
                  ),
  activo          boolean not null default true,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- Tabla: turnos
-- ============================================================
create table if not exists public.turnos (
  id         uuid primary key default gen_random_uuid(),
  fecha      date not null,
  franja     text not null check (
               franja in (
                 '08:00-13:00',
                 '13:00-18:00',
                 '18:00-23:00',
                 '23:00-08:00'
               )
             ),
  bombero_id uuid references public.bomberos (id),
  created_at timestamptz not null default now()
);

-- Cupo por celda (fecha + franja) SIEMPRE de una sola persona.
-- Índice único parcial: solo bloquea celdas que ya tienen bombero,
-- permitiendo crear/consultar celdas vacías sin conflicto.
-- La base de datos misma impide anotar dos personas en la misma celda
-- aunque lleguen dos pedidos al mismo tiempo.
create unique index if not exists turnos_celda_ocupada_uniq
  on public.turnos (fecha, franja)
  where bombero_id is not null;

-- Un bombero puede tener guardias en varios días/franjas a la vez.
-- La única restricción real es la de la celda (turnos_celda_ocupada_uniq):
-- nunca dos bomberos en la misma celda. Por eso NO hay índice por bombero.

-- Migración de esquemas viejos: la restricción "un bombero = una sola
-- guardia" (turnos_bombero_activo_uniq) ya no existe en este diseño y hay
-- que eliminarla si quedó en la base. Idempotente: si no existe, no hace nada.
alter table public.turnos drop constraint if exists turnos_bombero_activo_uniq;
drop index if exists public.turnos_bombero_activo_uniq;

-- Índices de apoyo para las consultas más frecuentes
create index if not exists idx_turnos_fecha
  on public.turnos (fecha);
create index if not exists idx_turnos_bombero_id
  on public.turnos (bombero_id);

-- ============================================================
-- Tabla: historial_cambios
-- ============================================================
create table if not exists public.historial_cambios (
  id                uuid primary key default gen_random_uuid(),
  turno_id          uuid not null references public.turnos (id),
  bombero_id        uuid not null references public.bomberos (id),
  accion            text not null check (
                      accion in ('anoto', 'cancelo', 'cambio')
                    ),
  turno_anterior_id uuid references public.turnos (id),
  nota              text,
  timestamp         timestamptz not null default now()
);

-- Nota opcional al cancelar (motivo). Idempotente para bases existentes.
alter table public.historial_cambios
  add column if not exists nota text;

create index if not exists idx_historial_turno_id
  on public.historial_cambios (turno_id);
create index if not exists idx_historial_bombero_id
  on public.historial_cambios (bombero_id);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================
alter table public.bomberos enable row level security;
alter table public.turnos enable row level security;
alter table public.historial_cambios enable row level security;

-- Lectura de bomberos: también pública para anónimos (anon), porque la
-- pantalla de login (sin sesión) busca el numero_ingreso y muestra la lista
-- de referencia "¿No recordás tu número?".
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'bomberos' and policyname = 'bomberos_select_anon'
  ) then
    create policy "bomberos_select_anon"
      on public.bomberos
      for select
      to anon
      using (true);
  end if;
end
$$;

-- Lectura: cualquier usuario autenticado puede ver bomberos y turnos.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'bomberos' and policyname = 'bomberos_select_authenticated'
  ) then
    create policy "bomberos_select_authenticated"
      on public.bomberos
      for select
      to authenticated
      using (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'turnos' and policyname = 'turnos_select_authenticated'
  ) then
    create policy "turnos_select_authenticated"
      on public.turnos
      for select
      to authenticated
      using (true);
  end if;
end
$$;

-- Lectura pública de turnos para el tablero en vivo: la suscripción Realtime
-- y el refresh del navegador usan la anon key. Se crea dentro de un bloque
-- idempotente para poder re-ejecutar el archivo sin error.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'turnos' and policyname = 'turnos_select_anon'
  ) then
    create policy "turnos_select_anon"
      on public.turnos
      for select
      to anon
      using (true);
  end if;
end
$$;

-- Lectura del historial para el log de despacho (/historial): tanto anon
-- como authenticated, porque la página y la suscripción Realtime usan la
-- anon key desde el navegador. Idempotente para poder re-ejecutar el archivo.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'historial_cambios' and policyname = 'historial_select_anon'
  ) then
    create policy "historial_select_anon"
      on public.historial_cambios
      for select
      to anon
      using (true);
  end if;
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'historial_cambios' and policyname = 'historial_select_authenticated'
  ) then
    create policy "historial_select_authenticated"
      on public.historial_cambios
      for select
      to authenticated
      using (true);
  end if;
end
$$;

-- Escritura: NO se definen políticas de insert/update/delete directas.
-- RLS deniega por defecto. Toda modificación de turnos e historial se hace
-- mediante las funciones RPC (SECURITY DEFINER) de supabase/rpc.sql, llamadas
-- únicamente desde los server actions con la clave service_role del servidor.
