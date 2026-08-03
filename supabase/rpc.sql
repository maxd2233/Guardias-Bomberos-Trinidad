-- ============================================================
-- Guardia Bomberos La Trinidad — RPC + Realtime
-- Ejecutar en el SQL Editor del dashboard de Supabase.
-- Requiere haber ejecutado antes supabase/schema.sql.
-- ============================================================

-- ------------------------------------------------------------
-- Notas de seguridad:
-- * Las funciones son SECURITY DEFINER: corren como su dueño
--   (postgres), con RLS desactivado, para poder escribir en turnos
--   e historial_cambios sin políticas de escritura.
-- * NO se otorga execute a anon/authenticated: solo el server action
--   y el cron job (clave service_role) las invocan. El parámetro
--   p_bombero_id siempre se deriva de la sesión firmada del servidor,
--   nunca del cliente.
-- * El índice único parcial turnos_celda_ocupada_uniq garantiza que
--   dos pedidos simultáneos sobre la misma celda no puedan convivir:
--   el segundo recibe un error 23505 y se revierte todo.
-- ------------------------------------------------------------

-- ============================================================
-- ocupar_celda
-- Helper interno: ocupa la celda (fecha + franja) asignándola a un
-- bombero. Si la celda ya tiene una fila generada y libre (bombero_id
-- null, creada por generar_turnos_ventana), la reutiliza; si no existe
-- ninguna, la crea. Devuelve el id del turno.
-- ============================================================
create or replace function public.ocupar_celda(
  p_fecha date,
  p_franja text,
  p_bombero_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_turno_id uuid;
begin
  -- Reutilizar una celda libre ya generada, si hay alguna.
  select id into v_turno_id
  from public.turnos
  where fecha = p_fecha and franja = p_franja and bombero_id is null
  order by id
  limit 1
  for update skip locked;

  if v_turno_id is null then
    insert into public.turnos (fecha, franja, bombero_id)
    values (p_fecha, p_franja, p_bombero_id)
    returning id into v_turno_id;
  else
    update public.turnos
    set bombero_id = p_bombero_id
    where id = v_turno_id;
  end if;

  return v_turno_id;
end;
$$;

-- ============================================================
-- anotar_turno
-- Registra una guardia nueva. Rechaza si la celda ya está ocupada.
-- Un bombero puede anotarse en varias celdas (días y franjas).
-- ============================================================
create or replace function public.anotar_turno(
  p_fecha date,
  p_franja text,
  p_bombero_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_turno_id uuid;
begin
  if not exists (
    select 1 from public.bomberos where id = p_bombero_id and activo
  ) then
    raise exception using errcode = 'P0001', message = 'BOMBERO_INACTIVO';
  end if;

  if p_franja not in ('08:00-13:00', '13:00-18:00', '18:00-23:00', '23:00-08:00') then
    raise exception using errcode = 'P0001', message = 'FRANJA_INVALIDA';
  end if;

  -- Única restricción: la celda (fecha + franja) ya está ocupada. Un bombero
  -- SÍ puede anotarse en varias celdas de la misma semana.
  if exists (
    select 1
    from public.turnos
    where fecha = p_fecha and franja = p_franja and bombero_id is not null
  ) then
    raise exception using errcode = 'P0001', message = 'CELDA_OCUPADA';
  end if;

  v_turno_id := public.ocupar_celda(p_fecha, p_franja, p_bombero_id);

  insert into public.historial_cambios (turno_id, bombero_id, accion)
  values (v_turno_id, p_bombero_id, 'anoto');

  return v_turno_id;
end;
$$;

-- ============================================================
-- cancelar_turno
-- Libera una celda (bombero_id = null) y registra el cambio.
-- Solo funciona si el turno pertenece al bombero que pide cancelar.
-- p_nota es opcional: si llega vacío (o null) se guarda sin nota.
-- ============================================================
drop function if exists public.cancelar_turno(uuid, uuid);

create or replace function public.cancelar_turno(
  p_turno_id uuid,
  p_bombero_id uuid,
  p_nota text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not exists (
    select 1 from public.bomberos where id = p_bombero_id and activo
  ) then
    raise exception using errcode = 'P0001', message = 'BOMBERO_INACTIVO';
  end if;

  -- Bloquea la fila para evitar cancelaciones dobles en paralelo.
  select id into v_id
  from public.turnos
  where id = p_turno_id and bombero_id = p_bombero_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'TURNO_NO_PERTENECE';
  end if;

  update public.turnos
  set bombero_id = null
  where id = p_turno_id;

  insert into public.historial_cambios (turno_id, bombero_id, accion, nota)
  values (p_turno_id, p_bombero_id, 'cancelo', nullif(p_nota, ''));

  return p_turno_id;
end;
$$;

-- ============================================================
-- cambiar_turno
-- Mueve la guardia de un bombero a otra celda: libera la anterior,
-- ocupa la nueva y registra accion = 'cambio' con turno_anterior_id.
-- Si la celda de destino fue tomada mientras tanto, el índice único
-- hace fallar TODO el cambio y la liberación anterior se revierte.
-- ============================================================
create or replace function public.cambiar_turno(
  p_turno_anterior_id uuid,
  p_fecha date,
  p_franja text,
  p_bombero_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_turno_nuevo_id uuid;
begin
  if not exists (
    select 1 from public.bomberos where id = p_bombero_id and activo
  ) then
    raise exception using errcode = 'P0001', message = 'BOMBERO_INACTIVO';
  end if;

  if p_franja not in ('08:00-13:00', '13:00-18:00', '18:00-23:00', '23:00-08:00') then
    raise exception using errcode = 'P0001', message = 'FRANJA_INVALIDA';
  end if;

  if not exists (
    select 1
    from public.turnos
    where id = p_turno_anterior_id and bombero_id = p_bombero_id
  ) then
    raise exception using errcode = 'P0001', message = 'TURNO_NO_PERTENECE';
  end if;

  if exists (
    select 1
    from public.turnos
    where fecha = p_fecha and franja = p_franja and bombero_id is not null
  ) then
    raise exception using errcode = 'P0001', message = 'CELDA_OCUPADA';
  end if;

  update public.turnos
  set bombero_id = null
  where id = p_turno_anterior_id;

  v_turno_nuevo_id := public.ocupar_celda(p_fecha, p_franja, p_bombero_id);

  insert into public.historial_cambios (turno_id, bombero_id, accion, turno_anterior_id)
  values (v_turno_nuevo_id, p_bombero_id, 'cambio', p_turno_anterior_id);

  return v_turno_nuevo_id;
end;
$$;

-- ============================================================
-- generar_turnos_ventana
-- Genera (idempotente) las filas de turnos de la ventana móvil
-- [p_fecha_inicio, p_fecha_inicio + p_dias - 1]: crea las celdas
-- (fecha + franja) que aún no existen, sin bombero asignado.
-- No toca ni borra turnos ya anotados: si una celda ya tiene fila
-- (asignada o no), se saltea. Por eso puede re-ejecutarse todos los
-- días sin duplicar nada, y los turnos de días pasados quedan intactos.
-- ============================================================
create or replace function public.generar_turnos_ventana(
  p_fecha_inicio date,
  p_dias integer
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creados integer := 0;
  v_fecha date;
  v_franja text;
begin
  if p_dias < 1 or p_dias > 60 then
    raise exception using errcode = 'P0001', message = 'DIAS_INVALIDOS';
  end if;

  for indice in 0 .. (p_dias - 1) loop
    v_fecha := p_fecha_inicio + indice;
    foreach v_franja in array array[
      '08:00-13:00', '13:00-18:00', '18:00-23:00', '23:00-08:00'
    ] loop
      insert into public.turnos (fecha, franja)
      select v_fecha, v_franja
      where not exists (
        select 1
        from public.turnos
        where fecha = v_fecha and franja = v_franja
      );
      if found then
        v_creados := v_creados + 1;
      end if;
    end loop;
  end loop;

  return v_creados;
end;
$$;

-- ============================================================
-- Panel de administración
-- Alta de bombero y baja lógica (activo = false, sin borrar
-- historial). El permiso lo chequea el server action con el cargo
-- de la sesión; el RPC valida los datos.
-- ============================================================
create or replace function public.crear_bombero(
  p_numero_ingreso integer,
  p_nombre_completo text,
  p_cargo text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_cargo not in ('Oficial Principal', 'Oficial Ayudante', 'Cabo', 'Bombero', 'Aspirante') then
    raise exception using errcode = 'P0001', message = 'CARGO_INVALIDO';
  end if;
  if p_nombre_completo is null or length(btrim(p_nombre_completo)) = 0 then
    raise exception using errcode = 'P0001', message = 'NOMBRE_INVALIDO';
  end if;
  if p_numero_ingreso is null or p_numero_ingreso < 1 then
    raise exception using errcode = 'P0001', message = 'NUMERO_INVALIDO';
  end if;

  insert into public.bomberos (numero_ingreso, nombre_completo, cargo)
  values (p_numero_ingreso, btrim(p_nombre_completo), p_cargo)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.dar_de_baja_bombero(
  p_bombero_id uuid
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.bomberos where id = p_bombero_id and activo) then
    return false;
  end if;

  -- No se puede dar de baja al último oficial activo (Oficial Principal o
  -- Ayudante): nadie podría entrar más al panel de administración.
  if (select cargo from public.bomberos where id = p_bombero_id)
     in ('Oficial Principal', 'Oficial Ayudante') then
    if (select count(*)
        from public.bomberos
        where activo and cargo in ('Oficial Principal', 'Oficial Ayudante')) <= 1 then
      raise exception using errcode = 'P0001', message = 'ULTIMO_OFICIAL';
    end if;
  end if;

  -- Libera las guardias anotadas del bombero para que las celdas queden
  -- libres y no queden "fantasmas" ocupando el tablero (el bombero dado
  -- de baja ya no puede cancelarlas por sí mismo).
  update public.turnos
  set bombero_id = null
  where bombero_id = p_bombero_id;

  update public.bomberos
  set activo = false
  where id = p_bombero_id;
  return found;
end;
$$;

-- ============================================================
-- Permisos
-- Por defecto Postgres otorga execute a PUBLIC: lo quitamos y solo
-- habilitamos la clave service_role (usada por los server actions).
-- ============================================================
revoke all on function public.ocupar_celda(date, text, uuid) from public;
revoke all on function public.anotar_turno(date, text, uuid) from public;
revoke all on function public.cancelar_turno(uuid, uuid, text) from public;
revoke all on function public.cambiar_turno(uuid, date, text, uuid) from public;
revoke all on function public.generar_turnos_ventana(date, integer) from public;
revoke all on function public.crear_bombero(integer, text, text) from public;
revoke all on function public.dar_de_baja_bombero(uuid) from public;

grant execute on function public.ocupar_celda(date, text, uuid) to service_role;
grant execute on function public.anotar_turno(date, text, uuid) to service_role;
grant execute on function public.cancelar_turno(uuid, uuid, text) to service_role;
grant execute on function public.cambiar_turno(uuid, date, text, uuid) to service_role;
grant execute on function public.generar_turnos_ventana(date, integer) to service_role;
grant execute on function public.crear_bombero(integer, text, text) to service_role;
grant execute on function public.dar_de_baja_bombero(uuid) to service_role;

-- ============================================================
-- Realtime
-- Publica turnos (tablero en vivo) e historial_cambios (log de
-- despacho). Idempotente: no falla si la tabla ya estaba publicada
-- o si la publicación no existe.
-- ============================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'turnos'
     ) then
    alter publication supabase_realtime add table public.turnos;
  end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'historial_cambios'
     ) then
    alter publication supabase_realtime add table public.historial_cambios;
  end if;
end
$$;
