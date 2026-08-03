import Image from "next/image";

type CardProps = {
  children: React.ReactNode;
  /** Estampa el escudo como sello de confirmación en muy baja opacidad. */
  stamped?: boolean;
  className?: string;
};

export function Card({
  children,
  stamped = false,
  className = "",
}: CardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-[10px] border-t-4 border-fire bg-surface shadow-[0_1px_3px_rgba(28,35,33,0.08)] ${className}`}
    >
      {stamped ? (
        <Image
          src="/logo.jpg"
          alt=""
          aria-hidden
          fill
          sizes="100%"
          className="pointer-events-none object-contain opacity-[0.06] mix-blend-multiply"
        />
      ) : null}
      <span
        aria-hidden
        className="absolute left-2 top-3 z-20 h-1 w-1 rounded-full bg-brass/70"
      />
      <span
        aria-hidden
        className="absolute right-2 top-3 z-20 h-1 w-1 rounded-full bg-brass/70"
      />
      <span
        aria-hidden
        className="absolute bottom-2 left-2 z-20 h-1 w-1 rounded-full bg-brass/70"
      />
      <span
        aria-hidden
        className="absolute bottom-2 right-2 z-20 h-1 w-1 rounded-full bg-brass/70"
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
