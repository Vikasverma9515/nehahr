export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex items-center justify-between">
      <div>
        <h1 className="font-display text-[24px] font-normal tracking-tight text-dark-text">{title}</h1>
        {description && <p className="mt-1 text-[13px] text-dark-text-muted">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
