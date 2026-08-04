"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ArrowLeftRight, Check, Clock } from "lucide-react";
import { Badge, isCargo } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import type { SessionBombero } from "@/lib/auth";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import {
  celdaKey,
  FRANJAS,
  fechasAConsultar,
  franjaActual,
  franjaCorta,
  franjaHora,
  normalizeTurnos,
  type Franja,
  type TurnoCelda,
} from "@/lib/tablero";
import { anotarTurno, cambiarTurno, cancelarTurno } from "./actions";

type RosterBombero = {
  numero_ingreso: number;
  nombre_completo: string;
  cargo: string;
};

type DiaTablero = {
  key: string;
  label: string;
};

type TableroProps = {
  session: SessionBombero;
  bomberos: Record<string, RosterBombero>;
  turnos: TurnoCelda[];
  dias: DiaTablero[];
  hoyKey: string;
  cupoMaximo: number;
};

type Dialogo =
  | { tipo: "anotar"; fechaKey: string; franja: Franja }
  | { tipo: "cancelar"; turno: TurnoCelda }
  | { tipo: "cambiar"; turno: TurnoCelda }
  | null;

function legajoLabel(numero: number) {
  return `Legajo N° ${String(numero).padStart(3, "0")}`;
}

type PersonaAnotadaProps = {
  bombero: RosterBombero;
  turno: TurnoCelda;
  esMio: boolean;
  onCancelar: (turno: TurnoCelda) => void;
  onCambiar: (turno: TurnoCelda) => void;
  showLegajo?: boolean;
};

function PersonaAnotada({
  bombero,
  turno,
  esMio,
  onCancelar,
  onCambiar,
  showLegajo = false,
}: PersonaAnotadaProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-[8px] px-2 py-2 ${
        esMio ? "ring-2 ring-brass/40" : ""
      }`}
    >
      <Image
        src="/logo.jpg"
        alt=""
        aria-hidden
        fill
        sizes="100%"
        className="pointer-events-none object-contain opacity-[0.06] mix-blend-multiply"
      />
      <div className="relative z-10">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {esMio ? <span className="sr-only">Tu turno</span> : null}
          <p
            className={`text-[16px] font-semibold leading-tight ${
              esMio ? "text-brass" : "text-ink"
            }`}
          >
            {bombero.nombre_completo}
          </p>
          {isCargo(bombero.cargo) ? <Badge cargo={bombero.cargo} /> : null}
        </div>
        {showLegajo ? (
          <p className="mt-0.5 font-mono text-[13px] text-ink-muted">
            {legajoLabel(bombero.numero_ingreso)}
          </p>
        ) : null}
        {esMio ? (
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCancelar(turno)}
            >
              Cancelar
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onCambiar(turno)}
            >
              <ArrowLeftRight className="h-4 w-4" aria-hidden />
              Cambiar turno
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function Tablero({
  session,
  bomberos: bomberosIniciales,
  turnos: turnosIniciales,
  dias,
  hoyKey,
  cupoMaximo,
}: TableroProps) {
  const [turnos, setTurnos] = useState(turnosIniciales);
  const [roster, setRoster] = useState(bomberosIniciales);
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [pendiente, setPendiente] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nota, setNota] = useState("");
  const [objetivo, setObjetivo] = useState<{
    fechaKey: string;
    franja: Franja;
  } | null>(null);
  const [actual, setActual] = useState<ReturnType<typeof franjaActual> | null>(
    null
  );

  const clientRef = useRef<ReturnType<typeof createBrowserSupabaseClient> | null>(
    null
  );
  const getClient = useCallback(() => {
    if (!clientRef.current) clientRef.current = createBrowserSupabaseClient();
    return clientRef.current;
  }, []);

  const refrescar = useCallback(async () => {
    try {
      const { data } = await getClient()
        .from("turnos")
        .select("id, fecha, franja, bombero_id")
        .in("fecha", fechasAConsultar(dias.map((dia) => dia.key)));
      if (data) setTurnos(normalizeTurnos(data));
    } catch (err) {
      console.error("No se pudo refrescar el tablero:", err);
    }
  }, [dias, getClient]);

  const refrescarBomberos = useCallback(async () => {
    try {
      const { data } = await getClient()
        .from("bomberos")
        .select("id, numero_ingreso, nombre_completo, cargo")
        .eq("activo", true);
      const mapa: Record<string, RosterBombero> = {};
      for (const b of data ?? []) {
        const r = b as Record<string, unknown>;
        if (
          typeof r.id === "string" &&
          typeof r.numero_ingreso === "number" &&
          typeof r.nombre_completo === "string" &&
          typeof r.cargo === "string"
        ) {
          mapa[r.id] = {
            numero_ingreso: r.numero_ingreso,
            nombre_completo: r.nombre_completo,
            cargo: r.cargo,
          };
        }
      }
      setRoster(mapa);
    } catch (err) {
      console.error("No se pudo refrescar el padrón:", err);
    }
  }, [getClient]);

  useEffect(() => {
    const update = () =>
      setActual((prev) => {
        const next = franjaActual(new Date());
        if (
          prev &&
          prev.fechaKey === next.fechaKey &&
          prev.franja === next.franja
        ) {
          return prev;
        }
        return next;
      });
    const intervalId = window.setInterval(update, 30_000);
    const timeoutId = window.setTimeout(update, 0);
    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    let channel: ReturnType<
      ReturnType<typeof createBrowserSupabaseClient>["channel"]
    > | null = null;
    try {
      channel = getClient()
        .channel("tablero-turnos")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "turnos" },
          () => {
            void refrescar();
          }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "bomberos" },
          () => {
            void refrescarBomberos();
          }
        )
        .subscribe();
    } catch (err) {
      console.error("No se pudo conectar a Realtime:", err);
    }
    return () => {
      if (channel) getClient().removeChannel(channel);
    };
  }, [getClient, refrescar, refrescarBomberos]);

  const porCelda = useMemo(() => {
    const mapa = new Map<string, TurnoCelda[]>();
    for (const turno of turnos) {
      const key = celdaKey(turno.fecha, turno.franja);
      const lista = mapa.get(key);
      if (lista) lista.push(turno);
      else mapa.set(key, [turno]);
    }
    return mapa;
  }, [turnos]);

  const turnosDeCelda = useCallback(
    (fechaKey: string, franja: Franja): TurnoCelda[] => {
      return porCelda.get(celdaKey(fechaKey, franja)) ?? [];
    },
    [porCelda]
  );

  const personasActuales = useMemo(() => {
    if (!actual) return [];
    return turnosDeCelda(actual.fechaKey, actual.franja)
      .map((turno) => ({ turno, bombero: roster[turno.bombero_id] }))
      .filter(
        (x): x is { turno: TurnoCelda; bombero: RosterBombero } =>
          x.bombero != null
      );
  }, [actual, roster, turnosDeCelda]);

  const opcionesCambio = useMemo(() => {
    if (!dialogo || dialogo.tipo !== "cambiar") return [];
    return dias
      .flatMap((dia) =>
        FRANJAS.map((franja) => ({
          fechaKey: dia.key,
          franja,
          label: `${dia.label} · ${franjaHora(franja)}`,
        }))
      )
      .filter((opcion) => {
        const esElMismo =
          opcion.fechaKey === dialogo.turno.fecha &&
          opcion.franja === dialogo.turno.franja;
        if (opcion.fechaKey < hoyKey || esElMismo) return false;
        const anotados = turnosDeCelda(opcion.fechaKey, opcion.franja);
        const yaAnotado = anotados.some(
          (turno) => turno.bombero_id === session.bombero_id
        );
        return !yaAnotado && anotados.length < cupoMaximo;
      });
  }, [dialogo, dias, hoyKey, session.bombero_id, turnosDeCelda, cupoMaximo]);

  function labelDia(fechaKey: string): string {
    return dias.find((dia) => dia.key === fechaKey)?.label ?? fechaKey;
  }

  function abrirAnotar(fechaKey: string, franja: Franja) {
    setError(null);
    setDialogo({ tipo: "anotar", fechaKey, franja });
  }

  function abrirCancelar(turno: TurnoCelda) {
    setError(null);
    setNota("");
    setDialogo({ tipo: "cancelar", turno });
  }

  function abrirCambiar(turno: TurnoCelda) {
    setError(null);
    setObjetivo(null);
    setDialogo({ tipo: "cambiar", turno });
  }

  function cerrarDialogo() {
    if (pendiente) return;
    setDialogo(null);
    setError(null);
    setObjetivo(null);
    setNota("");
  }

  async function ejecutarAccion() {
    if (!dialogo) return;
    setPendiente(true);
    setError(null);

    let resultado: { ok: boolean; error?: string } | null = null;
    if (dialogo.tipo === "anotar") {
      resultado = await anotarTurno(dialogo.fechaKey, dialogo.franja);
    } else if (dialogo.tipo === "cancelar") {
      resultado = await cancelarTurno(dialogo.turno.id, nota);
    } else if (dialogo.tipo === "cambiar" && objetivo) {
      resultado = await cambiarTurno(
        dialogo.turno.id,
        objetivo.fechaKey,
        objetivo.franja
      );
    }

    setPendiente(false);
    if (resultado?.ok) {
      setDialogo(null);
      setObjetivo(null);
    } else if (resultado) {
      setError(resultado.error ?? "Ocurrió un error. Intentá de nuevo.");
    }
    void refrescar();
  }

  function renderCeldaGrilla(dia: DiaTablero, franja: Franja) {
    const diaPasado = dia.key < hoyKey;
    const turnos = turnosDeCelda(dia.key, franja);
    const ocupados = turnos.length;
    const completo = ocupados >= cupoMaximo;
    const miTurno = turnos.find(
      (turno) => turno.bombero_id === session.bombero_id
    );

    if (diaPasado) {
      return (
        <Card key={franja} className="bg-bg p-3 opacity-60">
          <div className="flex h-full flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[13px] text-ink-muted">
                {ocupados > 0 ? `${ocupados}/${cupoMaximo} anotados` : "Sin asignar"}
              </span>
              {ocupados > 0 ? (
                <Check
                  className="h-5 w-5 text-brass"
                  strokeWidth={3}
                  aria-hidden
                />
              ) : null}
            </div>
            {ocupados === 0 ? null : (
              <div className="flex flex-col gap-1.5">
                {turnos.map((turno) => {
                  const bombero = roster[turno.bombero_id];
                  return bombero ? (
                    <div key={turno.id}>
                      <p className="text-[15px] font-semibold leading-tight">
                        {bombero.nombre_completo}
                      </p>
                      {isCargo(bombero.cargo) ? (
                        <Badge cargo={bombero.cargo} className="mt-1" />
                      ) : null}
                    </div>
                  ) : null;
                })}
              </div>
            )}
          </div>
        </Card>
      );
    }

    return (
      <Card key={franja} className="p-3">
        <div className="flex h-full flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[13px] uppercase tracking-widest text-ink-muted">
              {ocupados}/{cupoMaximo} anotados
            </span>
            {miTurno ? (
              <Check
                className="h-5 w-5 text-brass"
                strokeWidth={3}
                aria-hidden
              />
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            {turnos.map((turno) => {
              const bombero = roster[turno.bombero_id];
              if (!bombero) return null;
              return (
                <PersonaAnotada
                  key={turno.id}
                  bombero={bombero}
                  turno={turno}
                  esMio={turno.bombero_id === session.bombero_id}
                  onCancelar={abrirCancelar}
                  onCambiar={abrirCambiar}
                  showLegajo
                />
              );
            })}
          </div>

          {!miTurno ? (
            completo ? (
              <p className="text-[15px] font-semibold text-ink-muted">
                Cupo completo
              </p>
            ) : (
              <Button
                variant="primary"
                size="md"
                className="w-full"
                onClick={() => abrirAnotar(dia.key, franja)}
              >
                Anotarme
              </Button>
            )
          ) : null}
        </div>
      </Card>
    );
  }

  function renderFilaMovil(dia: DiaTablero, franja: Franja) {
    const diaPasado = dia.key < hoyKey;
    const turnos = turnosDeCelda(dia.key, franja);
    const ocupados = turnos.length;
    const completo = ocupados >= cupoMaximo;
    const miTurno = turnos.find(
      (turno) => turno.bombero_id === session.bombero_id
    );

    if (diaPasado) {
      return (
        <div key={franja} className="px-4 py-3 opacity-60">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[13px] uppercase tracking-widest text-ink-muted">
              {franja}
            </p>
            {ocupados > 0 ? (
              <span className="font-mono text-[13px] text-ink-muted">
                {ocupados}/{cupoMaximo}
              </span>
            ) : null}
          </div>
          {ocupados === 0 ? (
            <p className="mt-1 text-[17px] font-semibold leading-tight text-ink-muted">
              Sin asignar
            </p>
          ) : (
            <ul className="mt-1 space-y-2">
              {turnos.map((turno) => {
                const bombero = roster[turno.bombero_id];
                return bombero ? (
                  <li
                    key={turno.id}
                    className="flex flex-wrap items-center gap-x-2 gap-y-1"
                  >
                    <p className="text-[17px] font-semibold leading-tight">
                      {bombero.nombre_completo}
                    </p>
                    {isCargo(bombero.cargo) ? (
                      <Badge cargo={bombero.cargo} />
                    ) : null}
                  </li>
                ) : null;
              })}
            </ul>
          )}
        </div>
      );
    }

    return (
      <div key={franja} className="px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[13px] uppercase tracking-widest text-ink-muted">
            {franja}
          </p>
          <span className="font-mono text-[13px] uppercase tracking-widest text-ink-muted">
            {ocupados}/{cupoMaximo} anotados
          </span>
        </div>

        <div className="mt-2 flex flex-col gap-2">
          {turnos.map((turno) => {
            const bombero = roster[turno.bombero_id];
            if (!bombero) return null;
            return (
              <PersonaAnotada
                key={turno.id}
                bombero={bombero}
                turno={turno}
                esMio={turno.bombero_id === session.bombero_id}
                onCancelar={abrirCancelar}
                onCambiar={abrirCambiar}
              />
            );
          })}
        </div>

        {!miTurno ? (
          completo ? (
            <p className="mt-3 text-[15px] font-semibold text-ink-muted">
              Cupo completo
            </p>
          ) : (
            <Button
              variant="primary"
              size="md"
              className="mt-3 w-full"
              onClick={() => abrirAnotar(dia.key, franja)}
            >
              Anotarme
            </Button>
          )
        ) : null}
      </div>
    );
  }

  function renderDiasMoviles() {
    return (
      <div className="mt-6 space-y-4 md:hidden">
        {dias.map((dia) => {
          const esHoy = dia.key === hoyKey;
          const diaPasado = dia.key < hoyKey;
          return (
            <section
              key={dia.key}
              className="overflow-hidden rounded-[10px] border border-line bg-surface"
            >
              <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
                <p
                  className={`heading-display text-base ${
                    diaPasado ? "text-ink-muted" : "text-ink"
                  }`}
                >
                  {dia.label}
                </p>
                {esHoy ? (
                  <span className="font-mono text-[13px] uppercase tracking-widest text-fire">
                    Hoy
                  </span>
                ) : null}
              </header>
              <div className="divide-y divide-line">
                {FRANJAS.map((franja) =>
                  renderFilaMovil(dia, franja)
                )}
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  const confirmLabel =
    dialogo?.tipo === "anotar"
      ? "Sí, anotarme"
      : dialogo?.tipo === "cancelar"
        ? "Sí, cancelar"
        : "Sí, mover";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div>
        <h1 className="heading-display text-2xl">Tablero de guardias</h1>
        <p className="mt-1 text-[17px] text-ink-muted">
          Hasta {cupoMaximo} personas por turno. Tocá una celda con lugar para
          anotarte.
        </p>
      </div>

      <section className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[10px] border-l-4 border-alarm bg-alarm/15 px-4 py-3">
        <Clock
          className="h-5 w-5 shrink-0 text-alarm"
          strokeWidth={2.5}
          aria-hidden
        />
        <p className="heading-display text-sm text-alarm">En servicio ahora</p>
        {personasActuales.length > 0 ? (
          <>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {personasActuales.map(({ turno, bombero }, indice) => (
                <span key={turno.id} className="flex items-center gap-2">
                  {indice > 0 ? (
                    <span aria-hidden className="text-ink-muted">
                      ,
                    </span>
                  ) : null}
                  <span className="text-[17px] font-semibold">
                    {bombero.nombre_completo}
                  </span>
                  {isCargo(bombero.cargo) ? (
                    <Badge cargo={bombero.cargo} />
                  ) : null}
                </span>
              ))}
            </div>
            <p className="ml-auto font-mono text-[13px] uppercase tracking-widest text-alarm">
              {actual?.franja}
            </p>
          </>
        ) : (
          <p className="text-[17px] text-ink-muted">
            {actual
              ? "Nadie anotado en el turno actual"
              : "Calculando turno en servicio…"}
          </p>
        )}
      </section>

      {renderDiasMoviles()}

      <div className="mt-6 hidden overflow-x-auto md:block">
        <div className="min-w-[940px]">
          <div className="grid grid-cols-[160px_repeat(4,minmax(0,1fr))] gap-3">
            <div aria-hidden />
            {FRANJAS.map((franja) => (
              <p
                key={franja}
                className="heading-display text-center text-[15px] text-ink-muted"
              >
                {franja}
              </p>
            ))}
          </div>

          {dias.map((dia) => {
            const esHoy = dia.key === hoyKey;
            const diaPasado = dia.key < hoyKey;
            return (
              <div
                key={dia.key}
                className="mt-3 grid grid-cols-[160px_repeat(4,minmax(0,1fr))] items-stretch gap-3"
              >
                <div className="flex flex-col justify-center pr-2">
                  <p
                    className={`heading-display text-sm ${
                      diaPasado ? "text-ink-muted" : "text-ink"
                    }`}
                  >
                    {dia.label}
                  </p>
                  <p className="font-mono text-[13px] text-ink-muted">
                    {esHoy ? "Hoy" : diaPasado ? "Pasado" : ""}
                  </p>
                </div>
                {FRANJAS.map((franja) => renderCeldaGrilla(dia, franja))}
              </div>
            );
          })}
        </div>
      </div>

      <Modal
        open={dialogo?.tipo === "anotar"}
        onClose={cerrarDialogo}
        title="Confirmar guardia"
        confirmLabel={confirmLabel}
        cancelLabel="Volver"
        pending={pendiente}
        onConfirm={ejecutarAccion}
      >
        {dialogo?.tipo === "anotar" ? (
          <p>
            ¿Confirmás tu guardia del{" "}
            <strong>{labelDia(dialogo.fechaKey)}</strong>,{" "}
            <strong>{franjaHora(dialogo.franja)}</strong>?
          </p>
        ) : null}
        {error ? <ErrorAviso mensaje={error} /> : null}
      </Modal>

      <Modal
        open={dialogo?.tipo === "cancelar"}
        onClose={cerrarDialogo}
        title="Cancelar guardia"
        confirmLabel={confirmLabel}
        cancelLabel="Volver"
        pending={pendiente}
        onConfirm={ejecutarAccion}
      >
        {dialogo?.tipo === "cancelar" ? (
          <>
            <p>
              ¿Seguro que querés cancelar tu guardia del{" "}
              <strong>{labelDia(dialogo.turno.fecha)}</strong>,{" "}
              <strong>{franjaHora(dialogo.turno.franja)}</strong>? Esto va a
              quedar registrado en el historial.
            </p>
            <label
              htmlFor="nota-cancelar"
              className="mt-4 block text-[15px] font-semibold"
            >
              Nota (opcional)
            </label>
            <textarea
              id="nota-cancelar"
              value={nota}
              onChange={(event) => setNota(event.target.value)}
              placeholder="Ej.: me surgió un compromiso laboral"
              rows={2}
              maxLength={200}
              className="mt-2 w-full resize-none rounded-[10px] border border-line bg-bg px-4 py-3 text-[17px] text-ink placeholder:text-ink-muted/60 focus:border-fire focus:outline-none"
            />
            <p className="mt-1 text-right font-mono text-[13px] text-ink-muted">
              {nota.length}/200
            </p>
          </>
        ) : null}
        {error ? <ErrorAviso mensaje={error} /> : null}
      </Modal>

      <Modal
        open={dialogo?.tipo === "cambiar"}
        onClose={cerrarDialogo}
        title="Cambiar turno"
        confirmLabel={confirmLabel}
        cancelLabel="Volver"
        confirmDisabled={!objetivo}
        pending={pendiente}
        onConfirm={ejecutarAccion}
      >
        {dialogo?.tipo === "cambiar" ? (
          <>
            <p>
              ¿A qué turno querés mover tu guardia del{" "}
              <strong className="font-mono">
                {labelDia(dialogo.turno.fecha)}{" "}
                {franjaCorta(dialogo.turno.franja)}
              </strong>
              ?
            </p>
            {opcionesCambio.length > 0 ? (
              <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
                {opcionesCambio.map((opcion) => {
                  const seleccionada =
                    objetivo?.fechaKey === opcion.fechaKey &&
                    objetivo.franja === opcion.franja;
                  return (
                    <button
                      key={`${opcion.fechaKey}|${opcion.franja}`}
                      type="button"
                      onClick={() =>
                        setObjetivo({
                          fechaKey: opcion.fechaKey,
                          franja: opcion.franja,
                        })
                      }
                      aria-pressed={seleccionada}
                      className={`min-h-11 w-full cursor-pointer rounded-[10px] border px-4 py-3 text-left text-[17px] font-medium transition-colors duration-150 ${
                        seleccionada
                          ? "border-fire bg-fire/10 text-ink"
                          : "border-line bg-bg text-ink hover:border-ink/40"
                      }`}
                    >
                      {opcion.label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="mt-3 text-ink-muted">
                No hay turnos con lugar para mover tu guardia.
              </p>
            )}
            {objetivo ? (
              <p className="mt-5">
                ¿Confirmás mover tu guardia del{" "}
                <strong className="font-mono">
                  {labelDia(dialogo.turno.fecha)}{" "}
                  {franjaCorta(dialogo.turno.franja)}
                </strong>{" "}
                al{" "}
                <strong className="font-mono">
                  {labelDia(objetivo.fechaKey)} {franjaCorta(objetivo.franja)}
                </strong>
                ?
              </p>
            ) : null}
          </>
        ) : null}
        {error ? <ErrorAviso mensaje={error} /> : null}
      </Modal>
    </div>
  );
}

function ErrorAviso({ mensaje }: { mensaje: string }) {
  return (
    <p
      role="alert"
      className="mt-4 rounded-[10px] border-l-4 border-fire bg-fire/10 px-4 py-3 text-[17px] font-semibold text-ink"
    >
      {mensaje}
    </p>
  );
}
