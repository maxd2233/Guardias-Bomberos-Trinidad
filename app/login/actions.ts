"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession } from "@/lib/session";
import { createSupabaseClient } from "@/lib/supabase";

export type LoginState = { error: string | null };

export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const raw = formData.get("numero_ingreso");
  const numero = typeof raw === "string" ? parseInt(raw.trim(), 10) : NaN;

  if (!Number.isFinite(numero)) {
    return { error: "Ingresá tu número de ingreso." };
  }

  const supabase = createSupabaseClient();
  const { data: bombero, error } = await supabase
    .from("bomberos")
    .select("id, numero_ingreso, nombre_completo, cargo")
    .eq("numero_ingreso", numero)
    .eq("activo", true)
    .maybeSingle();

  if (error) {
    console.error("Error al buscar el bombero:", error.message);
    return {
      error: "Ocurrió un error al consultar el padrón. Volvé a intentar.",
    };
  }

  if (!bombero) {
    return {
      error: "Número no encontrado, contactate con la comisión directiva",
    };
  }

  try {
    await createSession({
      bombero_id: bombero.id,
      numero_ingreso: bombero.numero_ingreso,
      nombre_completo: bombero.nombre_completo,
      cargo: bombero.cargo,
    });
  } catch (err) {
    console.error("Error al crear la sesión:", err);
    return {
      error:
        "El servidor no está configurado para iniciar sesión. Avisale al encargado del sistema.",
    };
  }

  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
