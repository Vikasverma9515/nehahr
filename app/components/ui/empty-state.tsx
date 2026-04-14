import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-dark-border-light py-16">
      <Icon className="h-10 w-10 text-dark-text-muted" />
      <h3 className="mt-4 text-sm font-semibold text-dark-text">{title}</h3>
      <p className="mt-1 text-sm text-dark-text-muted">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
