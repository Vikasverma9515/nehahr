import { clsx } from "clsx";

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("card-glass rounded-2xl p-6", className)}>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="stat-glow rounded-2xl px-6 py-5">
      <p className="text-[11px] font-normal uppercase tracking-[0.1em] text-dark-text-muted">
        {label}
      </p>
      <p className="font-display mt-3 text-[42px] leading-none text-dark-text">
        {value}
      </p>
    </div>
  );
}
