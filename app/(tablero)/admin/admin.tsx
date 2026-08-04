"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, UserX } from "lucide-react";
import { Badge, CARGOS, isCargo, type Cargo } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { crearBombero, darDeBajaBombero } from "./actions";
import type { RosterBombero } from "./page";

const inputClasses =
  "h-11 w-full rounded-[10px] border border-line bg-bg px-4 text-[17px] text-ink placeholder:text-ink-muted/60 focus:border-fire focus:outline-none";

export function Admin({ bomberos }: { bomberos: RosterBombero[] }) {
  const router = useRouter();

  const [numeroIngreso, setNumeroIngreso] = useState("");
  const [nombre, setNombre] = useState("");
  const [cargo, setCargo] = useState<Cargo>("Bombero");
  const [pendiente, setPendiente] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [bajaId, setBajaId] = useState<string | null>(null);

  function limpiarAvisos() {
    setError(null);
    setAviso(null);
  }

  async function onAlta(event: FormEvent) {
    event.preventDefault();
    limpiarAvisos();
    setPendiente(true);
    const resultado = await crearBombero(Number(numeroIngreso), nombre, cargo);
    setPendiente(false);
    if (resultado.ok) {
      setNumeroIngreso("");
      setNombre("");
      setCargo("Bombero");
      setAviso("Bombero dado de alta.");
      router.refresh();
    } else {
      setError(resultado.error);
    }
  }

  async function onBaja(bomberoId: string) {
    limpiarAvisos();
    setPendiente(true);
    const resultado = await darDeBajaBombero(bomberoId);
    setPendiente(false);
    setBajaId(null);
    if (resultado.ok) {
      setAviso("Bombero dado de baja.");
      router.refresh();
    } else {
      setError(resultado.error);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div>
        <h1 className="heading-display text-2xl">Administración</h1>
        <p className="mt-1 text-[17px] text-ink-muted">
          Alta y baja de bomberos del cuartel. Dar de baja conserva el
          historial del bombero.
        </p>
      </div>

      {aviso ? (
        <p className="mt-4 rounded-[10px] border-l-4 border-ink/40 bg-ink/5 px-4 py-3 text-[17px] font-semibold text-ink">
          {aviso}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-[10px] border-l-4 border-fire bg-fire/10 px-4 py-3 text-[17px] font-semibold text-ink">
          {error}
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:items-start">
        <Card className="p-4 sm:p-5">
          <h2 className="heading-display text-lg">Dar de alta un bombero</h2>
          <form onSubmit={onAlta} className="mt-4 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[15px] font-semibold text-ink-muted">
                Número de ingreso
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                required
                value={numeroIngreso}
                onChange={(e) => setNumeroIngreso(e.target.value)}
                className={inputClasses}
                placeholder="Ej: 45"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[15px] font-semibold text-ink-muted">
                Nombre completo
              </span>
              <input
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className={inputClasses}
                placeholder="Apellido, Nombre"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[15px] font-semibold text-ink-muted">
                Cargo
              </span>
              <select
                value={cargo}
                onChange={(e) => {
                  if (isCargo(e.target.value)) setCargo(e.target.value);
                }}
                className={inputClasses}
              >
                {CARGOS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <Button
              type="submit"
              size="md"
              className="w-full"
              disabled={pendiente}
            >
              <UserPlus className="h-4 w-4" aria-hidden />
              Dar de alta
            </Button>
          </form>
        </Card>

        <Card className="p-4 sm:p-5">
          <h2 className="heading-display text-lg">
            Bomberos activos ({bomberos.length})
          </h2>
          {bomberos.length === 0 ? (
            <p className="mt-4 text-[17px] text-ink-muted">
              Todavía no hay bomberos cargados.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {bomberos.map((b) => (
                <li
                  key={b.id}
                  className="rounded-[10px] border border-line bg-bg px-4 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[17px] font-semibold leading-tight">
                        {b.nombre_completo}
                      </p>
                      <p className="mt-0.5 font-mono text-[13px] text-ink-muted">
                        Legajo N° {String(b.numero_ingreso).padStart(3, "0")}
                      </p>
                    </div>
                    {isCargo(b.cargo) ? <Badge cargo={b.cargo} /> : null}
                  </div>
                  {bajaId === b.id ? (
                    <div className="mt-3">
                      <p className="text-[17px] text-ink">
                        ¿Dar de baja a {b.nombre_completo}? Se conserva su
                        historial.
                      </p>
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                        <Button
                          size="md"
                          onClick={() => onBaja(b.id)}
                          disabled={pendiente}
                        >
                          <UserX className="h-4 w-4" aria-hidden />
                          Sí, dar de baja
                        </Button>
                        <Button
                          variant="secondary"
                          size="md"
                          onClick={() => setBajaId(null)}
                          disabled={pendiente}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="md"
                      className="mt-3"
                      onClick={() => {
                        limpiarAvisos();
                        setBajaId(b.id);
                      }}
                      disabled={pendiente}
                    >
                      <UserX className="h-4 w-4" aria-hidden />
                      Dar de baja
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
