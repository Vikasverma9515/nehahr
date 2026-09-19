import type { LucideIcon } from "lucide-react";
import { Illus, type IllusName } from "@/app/components/illus";

export function EmptyState({
  icon: Icon,
  art,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  /** A large Open Peeps character shown instead of the icon. */
  art?: IllusName;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-dark-border-light px-4 py-12 text-center">
      {art ? <Illus name={art} height={210} /> : <Icon className="h-10 w-10 text-dark-text-muted" />}
      <h3 className="mt-4 text-sm font-semibold text-dark-text">{title}</h3>
      <p className="mt-1 text-sm text-dark-text-muted">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
