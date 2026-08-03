import { type Cargo, CARGOS, isCargo } from "@/lib/cargos";

export { type Cargo, CARGOS, isCargo };

type BadgeProps = {
  cargo: Cargo;
  className?: string;
};

const toneClasses: Record<Cargo, string> = {
  "Oficial Principal": "border-fire/40 bg-fire/10 text-fire",
  "Oficial Ayudante": "border-ink bg-ink text-surface",
  Cabo: "border-ink-muted/40 bg-ink-muted/10 text-ink-muted",
  Bombero: "border-ink/30 bg-surface text-ink",
  Aspirante: "border-line bg-bg text-ink-muted",
};

export function Badge({ cargo, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-0.5 text-[15px] font-semibold leading-tight ${toneClasses[cargo]} ${className}`}
    >
      {cargo}
    </span>
  );
}
