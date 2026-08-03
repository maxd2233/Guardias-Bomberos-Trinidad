"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    login,
    { error: null }
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <label
          htmlFor="numero_ingreso"
          className="text-[17px] font-semibold"
        >
          Número de ingreso
        </label>
        <input
          id="numero_ingreso"
          name="numero_ingreso"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          autoFocus
          placeholder="Ej.: 0042"
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "login-error" : undefined}
          className="mt-2 h-16 w-full rounded-[10px] border border-ink/30 bg-surface px-4 text-center text-2xl font-semibold tracking-[0.2em] text-ink placeholder:tracking-normal placeholder:text-ink-muted/60 focus:border-fire"
        />
      </div>

      {state.error ? (
        <p
          id="login-error"
          role="alert"
          className="rounded-[10px] border-l-4 border-fire bg-fire/10 px-4 py-3 text-[17px] font-semibold text-ink"
        >
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-14 w-full cursor-pointer items-center justify-center rounded-[10px] bg-fire px-6 text-lg font-semibold text-surface transition-colors duration-150 hover:bg-fire-dark active:bg-fire-dark disabled:pointer-events-none disabled:opacity-60"
      >
        {pending ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
