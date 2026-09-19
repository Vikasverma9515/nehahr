/**
 * Neha brand mark: a bold "N" drawn as one continuous stroke on a violet tile,
 * with a small spark in the corner for the AI. The same artwork lives in
 * app/icon.svg for the browser tab.
 */
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[30%] shadow-lg shadow-accent/25 ${className}`}
      style={{ background: "linear-gradient(140deg, #a78bfa 0%, #8b5cf6 45%, #5b21b6 100%)" }}
      aria-hidden="true"
    >
      <span
        className="absolute inset-0"
        style={{ background: "radial-gradient(circle at 25% 15%, rgba(255,255,255,0.35), transparent 55%)" }}
      />
      <svg viewBox="0 0 48 48" className="relative h-[68%] w-[68%]" fill="none">
        <path
          d="M12 37V11l24 26V11"
          stroke="#fff"
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="40" cy="8" r="3.2" fill="#ede9fe" />
      </svg>
    </span>
  );
}

export function Logo({
  className = "",
  markClassName = "h-8 w-8",
  subtitle = true,
}: {
  className?: string;
  markClassName?: string;
  subtitle?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark className={markClassName} />
      <span className="leading-tight">
        <span className="block text-[15px] font-bold tracking-tight text-dark-text">Neha</span>
        {subtitle && (
          <span className="block text-[10px] font-medium uppercase tracking-[0.14em] text-dark-text-muted">
            AI HR Agent
          </span>
        )}
      </span>
    </span>
  );
}
