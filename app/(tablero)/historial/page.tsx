import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ahoraMs, cargarHistorial } from "@/lib/historial";
import { getSession } from "@/lib/session";
import { createSupabaseClient } from "@/lib/supabase";
import { Historial } from "./historial";

export const metadata: Metadata = {
  title: "Historial de guardias · Bomberos Voluntarios La Trinidad",
};

export const dynamic = "force-dynamic";

export default async function HistorialPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const entradas = await cargarHistorial(createSupabaseClient());

  return <Historial entradas={entradas} ahoraServer={ahoraMs()} />;
}
