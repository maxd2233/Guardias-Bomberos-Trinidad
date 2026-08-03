"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { createServiceRoleClient } from "@/lib/supabase";
import { hoyArgentina, isFranja } from "@/lib/tablero";

export type TurnoResult = { ok: true } | { ok: false; error: string };

const MSG_TURNO_TOMADO = "Alguien se anotó primero en este turno, elegí otro";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

function fechaValida(fecha: string): boolean {
  return FECHA_RE.test(fecha) && !Number.isNaN(new Date(`${fecha}T00:00:00`).getTime());
}

function mapRpcError(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { code?: string; message?: string };
    if (e.code === "23505") return MSG_TURNO_TOMADO;
    if (e.code === "P0001") {
      switch (e.message) {
        case "CELDA_OCUPADA":
          return MSG_TURNO_TOMADO;
        case "TURNO_NO_PERTENECE":
          return "Ese turno ya no te corresponde.";
        case "BOMBERO_INACTIVO":
          return "Tu usuario está dado de baja y no puede anotarse. Avisale a la comisión directiva.";
        default:
          break;
      }
    }
  }
  console.error("Error de RPC:", err);
  return "Ocurrió un error. Intentá de nuevo.";
}

export async function anotarTurno(
  fecha: string,
  franja: string
): Promise<TurnoResult> {
  const session = await getSession();
  if (!session) redirect("/login");

  if (!fechaValida(fecha) || !isFranja(franja)) {
    return { ok: false, error: "Datos de turno inválidos." };
  }
  if (fecha < hoyArgentina()) {
    return { ok: false, error: "No podés anotarte en una fecha pasada." };
  }

  const { error } = await createServiceRoleClient().rpc("anotar_turno", {
    p_fecha: fecha,
    p_franja: franja,
    p_bombero_id: session.bombero_id,
  });
  if (error) return { ok: false, error: mapRpcError(error) };
  return { ok: true };
}

export async function cancelarTurno(
  turnoId: string,
  nota?: string
): Promise<TurnoResult> {
  const session = await getSession();
  if (!session) redirect("/login");

  if (!UUID_RE.test(turnoId)) {
    return { ok: false, error: "Datos de turno inválidos." };
  }

  const notaFinal = nota?.trim() ? nota.trim() : null;
  const { error } = await createServiceRoleClient().rpc("cancelar_turno", {
    p_turno_id: turnoId,
    p_bombero_id: session.bombero_id,
    p_nota: notaFinal,
  });
  if (error) return { ok: false, error: mapRpcError(error) };
  return { ok: true };
}

export async function cambiarTurno(
  turnoId: string,
  fecha: string,
  franja: string
): Promise<TurnoResult> {
  const session = await getSession();
  if (!session) redirect("/login");

  if (!UUID_RE.test(turnoId) || !fechaValida(fecha) || !isFranja(franja)) {
    return { ok: false, error: "Datos de turno inválidos." };
  }
  if (fecha < hoyArgentina()) {
    return { ok: false, error: "No podés cambiar a una fecha pasada." };
  }

  const { error } = await createServiceRoleClient().rpc("cambiar_turno", {
    p_turno_anterior_id: turnoId,
    p_fecha: fecha,
    p_franja: franja,
    p_bombero_id: session.bombero_id,
  });
  if (error) return { ok: false, error: mapRpcError(error) };
  return { ok: true };
}
