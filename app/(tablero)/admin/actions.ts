"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { createServiceRoleClient } from "@/lib/supabase";
import { isCargo, isOficial } from "@/lib/cargos";

export type AdminResult = { ok: true } | { ok: false; error: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getSessionOficial(): Promise<boolean> {
  const session = await getSession();
  if (!session) redirect("/login");
  return isOficial(session.cargo);
}

export async function crearBombero(
  numero_ingreso: number,
  nombre_completo: string,
  cargo: string
): Promise<AdminResult> {
  const esOficial = await getSessionOficial();
  if (!esOficial) return { ok: false, error: "No tenés permiso para esta acción." };

  if (!Number.isInteger(numero_ingreso) || numero_ingreso < 1) {
    return { ok: false, error: "El número de ingreso debe ser un entero mayor a 0." };
  }
  const nombre = nombre_completo.trim();
  if (nombre.length < 2) {
    return { ok: false, error: "Ingresá el nombre completo del bombero." };
  }
  if (!isCargo(cargo)) {
    return { ok: false, error: "Cargo inválido." };
  }

  const { error } = await createServiceRoleClient().rpc("crear_bombero", {
    p_numero_ingreso: numero_ingreso,
    p_nombre_completo: nombre,
    p_cargo: cargo,
  });
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Ya existe un bombero con ese número de ingreso." };
    }
    console.error("Error de RPC crear_bombero:", error);
    return { ok: false, error: "Ocurrió un error. Intentá de nuevo." };
  }
  return { ok: true };
}

export async function darDeBajaBombero(bomberoId: string): Promise<AdminResult> {
  const esOficial = await getSessionOficial();
  if (!esOficial) return { ok: false, error: "No tenés permiso para esta acción." };

  if (!UUID_RE.test(bomberoId)) {
    return { ok: false, error: "Datos inválidos." };
  }

  const { error } = await createServiceRoleClient().rpc("dar_de_baja_bombero", {
    p_bombero_id: bomberoId,
  });
  if (error) {
    if (error.code === "P0001" && error.message === "ULTIMO_OFICIAL") {
      return {
        ok: false,
        error: "No podés dar de baja al último oficial del cuartel.",
      };
    }
    console.error("Error de RPC dar_de_baja_bombero:", error);
    return { ok: false, error: "Ocurrió un error. Intentá de nuevo." };
  }
  return { ok: true };
}
