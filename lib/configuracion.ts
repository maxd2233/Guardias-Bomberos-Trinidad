import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Clave de la fila en la tabla `configuracion` que define el cupo máximo
 * de personas por celda (fecha + franja) del tablero. El valor de
 * referencia vive en la base (`public.configuracion`, ver
 * supabase/schema.sql): las RPC de anotación lo leen en cada operación.
 */
export const CLAVE_CUPO_MAXIMO = "cupo_maximo_turnos";

/**
 * Cupo máximo por defecto. SOLO es el respaldo para la interfaz si la
 * lectura de `configuracion` falla; debe coincidir con la fila
 * 'cupo_maximo_turnos' cargada en la base.
 */
export const CUPO_MAXIMO_TURNOS = 5;

/**
 * Lee el cupo máximo vigente desde `configuracion`. Si la fila no existe
 * o la lectura falla, devuelve CUPO_MAXIMO_TURNOS en lugar de romper el
 * tablero.
 */
export async function leerCupoMaximo(
  client: SupabaseClient
): Promise<number> {
  try {
    const { data } = await client
      .from("configuracion")
      .select("valor")
      .eq("clave", CLAVE_CUPO_MAXIMO)
      .maybeSingle();
    if (data && typeof data.valor === "number" && data.valor > 0) {
      return data.valor;
    }
  } catch (err) {
    console.error("No se pudo leer el cupo máximo:", err);
  }
  return CUPO_MAXIMO_TURNOS;
}
