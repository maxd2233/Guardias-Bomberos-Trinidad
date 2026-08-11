import Image from "next/image";
import { LogOut } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { logout } from "@/app/login/actions";
import { getSession } from "@/lib/session";
import { isCargo, isOficial } from "@/lib/cargos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export async function Header() {
  const session = await getSession();
  const cargo = session && isCargo(session.cargo) ? session.cargo : null;

  return (
    <header className="no-print sticky top-0 z-20 border-b border-line bg-surface">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-3 py-2 sm:gap-3 sm:px-6 sm:py-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Image
            src="/logo.jpg"
            alt="Escudo de Bomberos Voluntarios La Trinidad"
            width={36}
            height={36}
            priority
            className="h-9 w-9 shrink-0 rounded-full object-cover"
          />
          <div className="min-w-0">
            <p className="heading-display truncate text-base leading-tight sm:text-lg">
              Bomberos Voluntarios
            </p>
            <p className="truncate font-mono text-[12px] uppercase tracking-widest text-ink-muted sm:text-[13px]">
              La Trinidad · Tucumán
            </p>
          </div>
        </div>

        {session ? (
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <div className="hidden min-w-0 text-right sm:block">
              <p className="truncate text-[17px] font-semibold leading-tight">
                {session.nombre_completo}
              </p>
              {cargo ? (
                <Badge cargo={cargo} className="mt-1" />
              ) : (
                <p className="font-mono text-[13px] text-ink-muted">
                  Legajo {String(session.numero_ingreso).padStart(3, "0")}
                </p>
              )}
            </div>
            <form action={logout}>
              <Button
                variant="ghost"
                size="md"
                type="submit"
                aria-label="Cerrar sesión"
              >
                <LogOut className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">Cerrar sesión</span>
              </Button>
            </form>
          </div>
        ) : null}
      </div>
      {session ? (
        <div className="border-t border-line">
          <div className="mx-auto w-full max-w-6xl px-3 sm:px-6">
            <AppNav oficial={session ? isOficial(session.cargo) : false} />
          </div>
        </div>
      ) : null}
    </header>
  );
}
