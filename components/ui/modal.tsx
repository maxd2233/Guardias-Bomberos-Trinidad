"use client";

import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmDisabled?: boolean;
  pending?: boolean;
  onConfirm?: () => void;
};

export function Modal({
  open,
  onClose,
  title,
  children,
  confirmLabel,
  cancelLabel = "Cancelar",
  confirmDisabled = false,
  pending = false,
  onConfirm,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, pending, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div
        className="absolute inset-0 bg-ink/50"
        onClick={pending ? undefined : onClose}
        aria-hidden
      />
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="relative w-full max-w-md rounded-[10px] border-t-4 border-fire bg-surface p-5 shadow-[0_8px_30px_rgba(28,35,33,0.25)] sm:p-6"
        >
          <h2 className="heading-display text-xl">{title}</h2>
          <div className="mt-3 text-[17px] leading-relaxed">{children}</div>
          {confirmLabel && onConfirm ? (
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={onClose} disabled={pending}>
                {cancelLabel}
              </Button>
              <Button
                variant="primary"
                onClick={onConfirm}
                disabled={pending || confirmDisabled}
              >
                {pending ? "Procesando…" : confirmLabel}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
