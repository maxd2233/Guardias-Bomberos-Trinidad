import type { SupabaseClient } from "@supabase/supabase-js";
import { isFranja, type Franja } from "./tablero";

export type HistorialAccion = "anoto" | "cancelo" | "cambio";

export type HistorialTurno = {
  fecha: string;
  franja: Franja;
};

export type HistorialEntry = {
  id: string;
  accion: HistorialAccion;
  bomberoNombre: string;
  nuevo: HistorialTurno | null;
  anterior: HistorialTurno | null;
  nota: string | null;
  timestamp: string;
};

type HistorialRow = {
  id?: unknown;
  turno_id?: unknown;
  bombero_id?: unknown;
  accion?: unknown;
  turno_anterior_id?: unknown;
  nota?: unknown;
  timestamp?: unknown;
};

/**
 * Filtra filas de historial_cambios dejando solo las válidas y les adjunta
 * el nombre del bombero y los turnos correspondientes (viejo y nuevo).
 */
export function assemblarHistorial(
  rows: unknown[],
  bomberos: Record<string, string>,
  turnos: Record<string, HistorialTurno>
): HistorialEntry[] {
  const entradas: HistorialEntry[] = [];
  for (const fila of rows) {
    if (typeof fila !== "object" || fila === null) continue;
    const r = fila as HistorialRow;
    if (
      typeof r.id !== "string" ||
      typeof r.turno_id !== "string" ||
      typeof r.bombero_id !== "string" ||
      typeof r.timestamp !== "string" ||
      (r.accion !== "anoto" && r.accion !== "cancelo" && r.accion !== "cambio")
    ) {
      continue;
    }
    entradas.push({
      id: r.id,
      accion: r.accion,
      bomberoNombre: bomberos[r.bombero_id] ?? "Bombero",
      nuevo: turnos[r.turno_id] ?? null,
      anterior:
        typeof r.turno_anterior_id === "string" && r.turno_anterior_id in turnos
          ? turnos[r.turno_anterior_id]
          : null,
      nota:
        typeof r.nota === "string" && r.nota !== "" ? r.nota : null,
      timestamp: r.timestamp,
    });
  }
  return entradas;
}

/**
 * Trae las últimas entradas del historial (más recientes primero) junto con
 * los turnos y bomberos necesarios para armar el texto del log. Funciona con
 * el cliente del servidor y con el del navegador (ambos con la anon key).
 */
export async function cargarHistorial(
  client: SupabaseClient
): Promise<HistorialEntry[]> {
  const { data: historial } = await client
    .from("historial_cambios")
    .select("id, turno_id, bombero_id, accion, turno_anterior_id, nota, timestamp")
    .order("timestamp", { ascending: false })
    .limit(50);

  const ids = new Set<string>();
  for (const h of historial ?? []) {
    const row = h as HistorialRow;
    if (typeof row.turno_id === "string") ids.add(row.turno_id);
    if (typeof row.turno_anterior_id === "string") ids.add(row.turno_anterior_id);
  }

  const turnos: Record<string, HistorialTurno> = {};
  if (ids.size > 0) {
    const { data: turnosData } = await client
      .from("turnos")
      .select("id, fecha, franja")
      .in("id", [...ids]);
    for (const t of turnosData ?? []) {
      const row = t as Record<string, unknown>;
      if (
        typeof row.id === "string" &&
        typeof row.fecha === "string" &&
        typeof row.franja === "string" &&
        isFranja(row.franja)
      ) {
        turnos[row.id] = { fecha: row.fecha, franja: row.franja };
      }
    }
  }

  const bomberos: Record<string, string> = {};
  const { data: bomberosData } = await client
    .from("bomberos")
    .select("id, nombre_completo")
    .eq("activo", true);
  for (const b of bomberosData ?? []) {
    const row = b as Record<string, unknown>;
    if (
      typeof row.id === "string" &&
      typeof row.nombre_completo === "string"
    ) {
      bomberos[row.id] = row.nombre_completo;
    }
  }

  return assemblarHistorial(historial ?? [], bomberos, turnos);
}

/** "hace 10 minutos", "hace 2 horas", "hace 3 días", "hace 1 mes" (es-AR). */
export function tiempoRelativo(iso: string, ahora: Date): string {
  const fecha = new Date(iso);
  const segundos = Math.round((ahora.getTime() - fecha.getTime()) / 1000);
  if (Number.isNaN(segundos)) return "";

  const rtf = new Intl.RelativeTimeFormat("es-AR", { numeric: "auto" });
  if (segundos > -60 && segundos < 60) return "hace unos segundos";

  const minutos = Math.round(segundos / 60);
  if (Math.abs(minutos) < 60) return rtf.format(minutos, "minute");

  const horas = Math.round(segundos / 3600);
  if (Math.abs(horas) < 24) return rtf.format(horas, "hour");

  const dias = Math.round(segundos / 86400);
  if (Math.abs(dias) < 30) return rtf.format(dias, "day");

  const meses = Math.round(segundos / (86400 * 30));
  return rtf.format(meses, "month");
}
