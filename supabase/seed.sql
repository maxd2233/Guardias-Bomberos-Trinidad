-- ============================================================
-- Guardia Bomberos La Trinidad — Seed inicial
-- Carga los primeros bomberos del padrón.
--
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de schema.sql
-- (y de rpc.sql). El INSERT es idempotente: si un número de
-- ingreso ya existe, no lo duplica.
--
-- IMPORTANTE: debe quedar al menos un bombero con cargo
-- 'Oficial Principal', porque /admin solo lo pueden usar
-- Oficial Principal u Oficial Ayudante.
--
-- Reemplazá 'NOMBRE APELLIDO' por los nombres reales. Agregá o
-- quitá filas según el padrón. Cargos válidos:
--   'Oficial Principal', 'Oficial Ayudante', 'Cabo', 'Bombero', 'Aspirante'
-- ============================================================

insert into public.bomberos (numero_ingreso, nombre_completo, cargo)
values
  (1,  'NOMBRE APELLIDO',  'Oficial Principal'),
  (2,  'NOMBRE APELLIDO',  'Oficial Ayudante'),
  (3,  'NOMBRE APELLIDO',  'Cabo'),
  (4,  'NOMBRE APELLIDO',  'Bombero'),
  (5,  'NOMBRE APELLIDO',  'Bombero'),
  (6,  'NOMBRE APELLIDO',  'Aspirante')
on conflict (numero_ingreso) do nothing;
