import { ChevronDown } from "lucide-react";

export type RosterBombero = {
  numero_ingreso: number;
  nombre_completo: string;
};

function formatLegajo(numero: number) {
  return String(numero).padStart(4, "0");
}

export function RosterList({ bomberos }: { bomberos: RosterBombero[] }) {
  return (
    <details className="group rounded-[10px] border border-line bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="text-[17px] font-semibold">
          ¿No recordás tu número?
        </span>
        <ChevronDown
          className="h-5 w-5 shrink-0 text-ink-muted transition-transform duration-150 group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="border-t border-line">
        <p className="px-4 pt-3 text-[17px] text-ink-muted">
          Lista de referencia del cuartel (solo lectura):
        </p>
        <ul className="divide-y divide-line pb-2">
          {bomberos.map((bombero) => (
            <li
              key={bombero.numero_ingreso}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <span className="min-w-0 text-[17px] font-medium leading-tight">
                {bombero.nombre_completo}
              </span>
              <span className="shrink-0 font-mono text-[15px] text-ink-muted">
                {formatLegajo(bombero.numero_ingreso)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
