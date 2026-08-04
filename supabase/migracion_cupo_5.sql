-- ============================================================
-- Migración: cupo de 5 personas por celda (fecha + franja)
-- Ejecutar en el SQL Editor de Supabase, DESPUÉS de schema.sql y
-- rpc.sql actualizados. Idempotente: puede re-ejecutarse sin error.
-- ============================================================

-- 1) Eliminar el índice único parcial que limitaba la celda a UNA persona.
--    Permite ahora múltiples filas con la misma (fecha, franja) pero con
--    bombero_id distinto.
drop index if exists public.turnos_celda_ocupada_uniq;

-- 2) El MISMO bombero no puede anotarse dos veces en la misma celda exacta.
--    Los NULL quedan libres: una cancelación (bombero_id = null) libera su
--    lugar sin afectar a las demás personas anotadas en la celda.
create unique index if not exists turnos_celda_bombero_uniq
  on public.turnos (fecha, franja, bombero_id)
  where bombero_id is not null;

-- 3) Tabla de configuración: fuente única del cupo máximo. La RPC de
--    anotación lo lee en cada operación; cambiando este valor se cambia el
--    cupo sin tocar código.
create table if not exists public.configuracion (
  clave text primary key,
  valor integer not null
);

insert into public.configuracion (clave, valor)
values ('cupo_maximo_turnos', 5)
on conflict (clave) do nothing;

-- 4) RLS: lectura pública de configuración (el tablero la lee con la anon
--    key desde el servidor y el navegador). Idempotente.
alter table public.configuracion enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'configuracion' and policyname = 'configuracion_select_anon'
  ) then
    create policy "configuracion_select_anon"
      on public.configuracion
      for select
      to anon
      using (true);
  end if;
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'configuracion' and policyname = 'configuracion_select_authenticated'
  ) then
    create policy "configuracion_select_authenticated"
      on public.configuracion
      for select
      to authenticated
      using (true);
  end if;
end
$$;
