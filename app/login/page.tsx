import type { Metadata } from "next";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { createSupabaseClient } from "@/lib/supabase";
import { LoginForm } from "./login-form";
import { RosterList, type RosterBombero } from "./roster-list";

export const metadata: Metadata = {
  title: "Ingresar · Bomberos Voluntarios La Trinidad",
};

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  let bomberos: RosterBombero[] = [];

  try {
    const supabase = createSupabaseClient();
    const { data } = await supabase
      .from("bomberos")
      .select("numero_ingreso, nombre_completo")
      .eq("activo", true)
      .order("nombre_completo", { ascending: true });
    bomberos = (data ?? []).filter(
      (bombero): bombero is RosterBombero =>
        typeof bombero.numero_ingreso === "number" &&
        typeof bombero.nombre_completo === "string"
    );
  } catch (err) {
    console.error("No se pudo cargar el padrón:", err);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          <Image
            src="/logo.jpg"
            alt="Escudo de Bomberos Voluntarios La Trinidad"
            width={120}
            height={120}
            priority
            className="h-28 w-28 rounded-full object-cover shadow-[0_2px_8px_rgba(28,35,33,0.18)]"
          />
          <h1 className="heading-display mt-6 text-3xl">
            Bomberos Voluntarios
          </h1>
          <p className="mt-1 font-mono text-[13px] uppercase tracking-widest text-ink-muted">
            La Trinidad · Tucumán
          </p>
        </div>

        <Card className="mt-8 p-6">
          <LoginForm />
        </Card>

        <div className="mt-6">
          <RosterList bomberos={bomberos} />
        </div>
      </div>
    </div>
  );
}
