"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  cargarHistorial,
  formatTimestamp,
  tiempoRelativo,
  type HistorialEntry,
  type HistorialTurno,
} from "@/lib/historial";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import { formatFechaKey, franjaCorta } from "@/lib/tablero";

function TurnoMono({ turno }: { turno: HistorialTurno }) {
  return (
    <span className="font-mono text-[15px]">
      {formatFechaKey(turno.fecha)} {franjaCorta(turno.franja)}
    </span>
  );
}

function textoEntrada(entrada: HistorialEntry) {
  if (entrada.accion === "anoto") {
    return (
      <>
        {entrada.bomberoNombre} se anotó en{" "}
        {entrada.nuevo ? <TurnoMono turno={entrada.nuevo} /> : "un turno"}
      </>
    );
  }
  if (entrada.accion === "cancelo") {
    return (
      <>
        {entrada.bomberoNombre} canceló su guardia del{" "}
        {entrada.nuevo ? <TurnoMono turno={entrada.nuevo} /> : "un turno"}
      </>
    );
  }
  return (
    <>
      {entrada.bomberoNombre} cambió del{" "}
      {entrada.anterior ? <TurnoMono turno={entrada.anterior} /> : "su turno"}{" "}
      al {entrada.nuevo ? <TurnoMono turno={entrada.nuevo} /> : "otro turno"}
    </>
  );
}

export function Historial({
  entradas: iniciales,
  ahoraServer,
}: {
  entradas: HistorialEntry[];
  ahoraServer: number;
}) {
  const [entradas, setEntradas] = useState(iniciales);
  const [ahora, setAhora] = useState<Date>(() => new Date(ahoraServer));

  const clientRef = useRef<ReturnType<typeof createBrowserSupabaseClient> | null>(
    null
  );
  const getClient = useCallback(() => {
    if (!clientRef.current) clientRef.current = createBrowserSupabaseClient();
    return clientRef.current;
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(
      () => setAhora((prev) => new Date(prev.getTime() + 60_000)),
      60_000
    );
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    let channel: ReturnType<
      ReturnType<typeof createBrowserSupabaseClient>["channel"]
    > | null = null;
    try {
      channel = getClient()
        .channel("historial-cambios")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "historial_cambios" },
          () => {
            void cargarHistorial(getClient()).then(setEntradas);
          }
        )
        .subscribe();
    } catch (err) {
      console.error("No se pudo conectar a Realtime:", err);
    }
    return () => {
      if (channel) getClient().removeChannel(channel);
    };
  }, [getClient]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div>
        <h1 className="heading-display text-2xl">Historial de guardias</h1>
        <p className="mt-1 text-[17px] text-ink-muted">
          Anotaciones, cancelaciones y cambios de turno, del más reciente al
          más antiguo.
        </p>
      </div>

      {entradas.length === 0 ? (
        <p className="mt-8 rounded-[10px] border border-line bg-surface px-4 py-6 text-center text-ink-muted">
          Todavía no hay movimientos registrados.
        </p>
      ) : (
        <ol className="mt-6 divide-y divide-line overflow-hidden rounded-[10px] border border-line bg-surface">
          {entradas.map((entrada) => (
            <li key={entrada.id} className="px-4 py-3 sm:px-5">
              <p className="text-[17px] leading-relaxed">
                {textoEntrada(entrada)}
                <span className="font-mono text-[15px] text-ink-muted">
                  {" "}
                  — {tiempoRelativo(entrada.timestamp, ahora)}{" "}
                  <span className="whitespace-nowrap">
                    · {formatTimestamp(entrada.timestamp)}
                  </span>
                </span>
              </p>
              {entrada.nota ? (
                <p className="mt-1 text-[17px] italic text-ink-muted">
                  “{entrada.nota}”
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
