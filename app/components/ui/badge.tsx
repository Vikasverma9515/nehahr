import { clsx } from "clsx";

type Variant = "purple" | "green" | "red" | "yellow" | "blue" | "gray";

// Neutral dark background on all badges. Text gets a *subtle* tint — enough
// to tell stages apart at a glance without turning the page into a rainbow.
const variants: Record<Variant, string> = {
  purple: "bg-white/[0.05] text-[#b4a0e8] border-white/[0.08]",
  green: "bg-white/[0.05] text-[#7dd4a8] border-white/[0.08]",
  red: "bg-white/[0.05] text-[#e8908a] border-white/[0.08]",
  yellow: "bg-white/[0.05] text-[#d4c27d] border-white/[0.08]",
  blue: "bg-white/[0.05] text-[#8ab4d9] border-white/[0.08]",
  gray: "bg-white/[0.05] text-dark-text-secondary border-white/[0.08]",
};

const stageVariants: Record<string, Variant> = {
  new: "gray", screening: "yellow", screened: "blue", shortlisted: "purple",
  scheduling: "purple", scheduled: "blue", interviewing: "yellow",
  offer: "green", pre_joining: "green", joined: "green",
  rejected: "red", withdrawn: "red", no_show: "red",
  queued: "gray", ringing: "yellow", in_progress: "blue",
  completed: "green", failed: "red", no_answer: "yellow", busy: "yellow",
  open: "blue", paused: "yellow", closed: "gray",
  resolved: "green", escalated: "yellow",
  pending: "yellow", submitted: "green", overdue: "red", requested: "blue",
  pass: "green", fail: "red", hold: "yellow",
  qualified: "green", unqualified: "red",
};

export function Badge({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant?: Variant;
}) {
  const resolvedVariant = variant || stageVariants[String(children).toLowerCase()] || "gray";
  return (
    <span className={clsx(
      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
      variants[resolvedVariant]
    )}>
      {children}
    </span>
  );
}
