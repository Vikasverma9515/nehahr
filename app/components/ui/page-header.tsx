import { Illus, type IllusName } from "@/app/components/illus";

export function PageHeader({
  title,
  description,
  action,
  art,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** A character standing at the right edge of the header. */
  art?: IllusName;
}) {
  return (
    <div className="relative mb-8 flex items-center justify-between">
      <div>
        <h1 className="font-display text-[24px] font-normal tracking-tight text-dark-text">{title}</h1>
        {description && <p className="mt-1 text-[13px] text-dark-text-muted">{description}</p>}
      </div>
      <div className="flex items-end gap-6">
        {art && <Illus name={art} height={96} className="hidden sm:inline-block" glow={false} />}
        {action && <div className="self-center">{action}</div>}
      </div>
    </div>
  );
}
