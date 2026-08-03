import { NextResponse } from "next/server";
import {
  hoyArgentina,
  lunesDeSemana,
  VENTANA_DIAS,
} from "@/lib/tablero";
import { createServiceRoleClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron diario de Vercel (ver vercel.json): garantiza que el tablero siempre
 * tenga VENTANA_DIAS días disponibles hacia adelante. Vercel envía el valor de
 * CRON_SECRET como "Authorization: Bearer <CRON_SECRET>"; si no coincide, se
 * rechaza la petición con 401.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const fechaInicio = lunesDeSemana(hoyArgentina());
  const { data: creados, error } = await createServiceRoleClient().rpc(
    "generar_turnos_ventana",
    { p_fecha_inicio: fechaInicio, p_dias: VENTANA_DIAS }
  );

  if (error) {
    console.error("No se pudo generar la ventana de turnos:", error);
    return NextResponse.json(
      { error: "No se pudo generar los turnos" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    fecha_inicio: fechaInicio,
    dias: VENTANA_DIAS,
    turnos_creados: creados ?? 0,
  });
}
