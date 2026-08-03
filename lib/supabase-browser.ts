import { createClient } from "@supabase/supabase-js";

/**
 * Cliente para el navegador: suscripciones Realtime y lectura del tablero.
 * Usa únicamente la anon key (solo lectura de turnos vía RLS).
 */
export function createBrowserSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local."
    );
  }
  return createClient(url, anonKey);
}
