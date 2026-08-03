import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase";
import { getSession } from "@/lib/session";
import {
  fechasAConsultar,
  formatFechaKey,
  hoyArgentina,
  lunesDeSemana,
  normalizeTurnos,
  sumarDias,
  VENTANA_DIAS,
} from "@/lib/tablero";
import { Tablero } from "./tablero";

export const metadata: Metadata = {
  title: "Tablero de guardias · Bomberos Voluntarios La Trinidad",
};

export const dynamic = "force-dynamic";

type BomberoRoster = {
  numero_ingreso: number;
  nombre_completo: string;
  cargo: string;
};

export default async function TableroPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const hoyKey = hoyArgentina();
  const inicioSemana = lunesDeSemana(hoyKey);
  const dias = Array.from({ length: VENTANA_DIAS }, (_, indice) => {
    const key = sumarDias(inicioSemana, indice);
    return { key, label: formatFechaKey(key) };
  });

  const supabase = createSupabaseClient();

  const bomberos: Record<string, BomberoRoster> = {};
  const { data: bomberosData } = await supabase
    .from("bomberos")
    .select("id, numero_ingreso, nombre_completo, cargo")
    .eq("activo", true);
  for (const bombero of bomberosData ?? []) {
    if (
      typeof bombero.id === "string" &&
      typeof bombero.numero_ingreso === "number" &&
      typeof bombero.nombre_completo === "string" &&
      typeof bombero.cargo === "string"
    ) {
      bomberos[bombero.id] = {
        numero_ingreso: bombero.numero_ingreso,
        nombre_completo: bombero.nombre_completo,
        cargo: bombero.cargo,
      };
    }
  }

  const { data: turnosData } = await supabase
    .from("turnos")
    .select("id, fecha, franja, bombero_id")
    .in("fecha", fechasAConsultar(dias.map((dia) => dia.key)));

  return (
    <Tablero
      session={session}
      bomberos={bomberos}
      turnos={normalizeTurnos(turnosData ?? [])}
      dias={dias}
      hoyKey={hoyKey}
    />
  );
}
