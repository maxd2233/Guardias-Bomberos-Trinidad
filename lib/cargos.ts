export type Cargo =
  | "Oficial Principal"
  | "Oficial Ayudante"
  | "Cabo"
  | "Bombero"
  | "Aspirante";

export const CARGOS: Cargo[] = [
  "Oficial Principal",
  "Oficial Ayudante",
  "Cabo",
  "Bombero",
  "Aspirante",
];

export const CARGOS_OFICIALES: Cargo[] = ["Oficial Principal", "Oficial Ayudante"];

export function isCargo(value: string): value is Cargo {
  return (CARGOS as string[]).includes(value);
}

export function isOficial(cargo: string): boolean {
  return (CARGOS_OFICIALES as string[]).includes(cargo);
}
