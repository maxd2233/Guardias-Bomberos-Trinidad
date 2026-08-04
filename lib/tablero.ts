export const FRANJAS = [
  "08:00-13:00",
  "13:00-18:00",
  "18:00-23:00",
  "23:00-08:00",
] as const;

export type Franja = (typeof FRANJAS)[number];

/** Días que el tablero muestra hacia adelante (ventana móvil). */
export const VENTANA_DIAS = 14;

export function isFranja(value: string): value is Franja {
  return (FRANJAS as readonly string[]).includes(value);
}

export type TurnoCelda = {
  id: string;
  fecha: string;
  franja: Franja;
  bombero_id: string;
};

/** Clave canónica de una celda (fecha + franja) para agrupar anotaciones. */
export function celdaKey(fecha: string, franja: Franja): string {
  return `${fecha}|${franja}`;
}

/** Filtra filas de Supabase dejando solo turnos válidos (shape conocido). */
export function normalizeTurnos(rows: unknown[]): TurnoCelda[] {
  const resultado: TurnoCelda[] = [];
  for (const row of rows) {
    if (typeof row !== "object" || row === null) continue;
    const r = row as Record<string, unknown>;
    if (
      typeof r.id === "string" &&
      typeof r.fecha === "string" &&
      typeof r.franja === "string" &&
      isFranja(r.franja) &&
      typeof r.bombero_id === "string" &&
      r.bombero_id !== ""
    ) {
      resultado.push({
        id: r.id,
        fecha: r.fecha,
        franja: r.franja,
        bombero_id: r.bombero_id,
      });
    }
  }
  return resultado;
}

/** Fecha local como "YYYY-MM-DD" (sin desfase de zona horaria). */
export function dateToKey(date: Date): string {
  const anio = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, "0");
  const dia = String(date.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

/** Fecha de hoy en la zona horaria de la guardia (Tucumán) como "YYYY-MM-DD". */
export function hoyArgentina(): string {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Tucuman",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (tipo: string) =>
    partes.find((parte) => parte.type === tipo)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Suma días a una fecha "YYYY-MM-DD" y devuelve otra "YYYY-MM-DD". */
export function sumarDias(fechaISO: string, dias: number): string {
  const [anio, mes, dia] = fechaISO.split("-").map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia + dias));
  return fecha.toISOString().slice(0, 10);
}

/** Fechas a consultar en la BD: la ventana visible más el día anterior al inicio,
 *  necesario para la guardia nocturna (23:00-08:00) que queda activa entre las
 *  00:00 y 07:59 (p. ej. el domingo previo, un lunes de madrugada). */
export function fechasAConsultar(dias: readonly string[]): string[] {
  if (dias.length === 0) return [];
  const conjunto = new Set<string>(dias);
  conjunto.add(sumarDias(dias[0], -1));
  return Array.from(conjunto);
}

/** Lunes de la semana calendario a la que pertenece una fecha "YYYY-MM-DD". */
export function lunesDeSemana(fechaISO: string): string {
  const [anio, mes, dia] = fechaISO.split("-").map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  const diaSemana = fecha.getUTCDay(); // 0 = domingo
  const offset = diaSemana === 0 ? -6 : 1 - diaSemana;
  fecha.setUTCDate(fecha.getUTCDate() + offset);
  return fecha.toISOString().slice(0, 10);
}

const DIAS_SEMANA = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

/** Etiqueta de día para el tablero: "Lunes 03/08". */
export function formatFechaCorta(date: Date): string {
  const dia = DIAS_SEMANA[date.getDay()];
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dia} ${dd}/${mm}`;
}

/** "18:00-23:00" -> "de 18:00 a 23:00hs" */
export function franjaHora(franja: Franja): string {
  const [desde, hasta] = franja.split("-");
  return `de ${desde} a ${hasta}hs`;
}

/** "18:00-23:00" -> "18-23hs" (formato compacto para confirmaciones y log) */
export function franjaCorta(franja: Franja): string {
  const [desde, hasta] = franja.split("-");
  return `${desde.slice(0, 2)}-${hasta.slice(0, 2)}hs`;
}

/** "2026-08-03" -> "Lunes 03/08" */
export function formatFechaKey(fechaKey: string): string {
  const [anio, mes, dia] = fechaKey.split("-").map(Number);
  if (!anio || !mes || !dia) return fechaKey;
  const date = new Date(anio, mes - 1, dia);
  if (Number.isNaN(date.getTime())) return fechaKey;
  return formatFechaCorta(date);
}

/** Franja y fecha de la guardia activa en un momento dado (hora local). */
export function franjaActual(now: Date): { fechaKey: string; franja: Franja } {
  const hora = now.getHours();
  const fecha = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (hora >= 23) {
    return { fechaKey: dateToKey(fecha), franja: "23:00-08:00" };
  }
  if (hora < 8) {
    // La guardia nocturna empezó la noche anterior.
    const ayer = new Date(fecha);
    ayer.setDate(fecha.getDate() - 1);
    return { fechaKey: dateToKey(ayer), franja: "23:00-08:00" };
  }
  if (hora < 13) return { fechaKey: dateToKey(fecha), franja: "08:00-13:00" };
  if (hora < 18) return { fechaKey: dateToKey(fecha), franja: "13:00-18:00" };
  return { fechaKey: dateToKey(fecha), franja: "18:00-23:00" };
}
