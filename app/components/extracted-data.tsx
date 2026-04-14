import {
  MapPin,
  Home,
  Briefcase,
  DollarSign,
  TrendingUp,
  Clock,
  AlertCircle,
  FileText,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type ExtractedData = Record<string, unknown> | null;

const FIELD_CONFIG: Record<
  string,
  { label: string; icon: LucideIcon; format?: (v: unknown) => string }
> = {
  current_location: { label: "Location", icon: MapPin },
  open_to_relocation: {
    label: "Open to Relocation",
    icon: Home,
    format: (v) => (v ? "Yes" : "No"),
  },
  work_model_preference: {
    label: "Work Model",
    icon: Briefcase,
    format: (v) => String(v).replace(/_/g, " "),
  },
  employment_status: {
    label: "Employment Status",
    icon: Briefcase,
    format: (v) => String(v).replace(/_/g, " "),
  },
  current_ctc: {
    label: "Current CTC",
    icon: DollarSign,
    format: formatCtc,
  },
  expected_ctc: {
    label: "Expected CTC",
    icon: TrendingUp,
    format: formatCtc,
  },
  notice_period_days: {
    label: "Notice Period",
    icon: Clock,
    format: (v) => `${v} days`,
  },
  reason_for_leaving: { label: "Reason for Leaving", icon: AlertCircle },
  role_specific_answers: {
    label: "Role-Specific",
    icon: FileText,
    format: (v) => {
      if (typeof v === "object" && v !== null) {
        return Object.entries(v as Record<string, unknown>)
          .map(([k, val]) => `${k.replace(/_/g, " ")}: ${val}`)
          .join(" - ");
      }
      return String(v);
    },
  },
};

/**
 * Normalize a raw salary number to LPA (lakhs per annum).
 * - If value >= 100000, assume it's in rupees and convert to lakhs
 * - Otherwise assume it's already in LPA (e.g. 16 = 16 LPA)
 * - Returns a clean string like "3.6" or "16"
 */
function normalizeToLpa(value: unknown): string | null {
  if (value == null) return null;
  const num = typeof value === "number" ? value : parseFloat(String(value));
  if (isNaN(num)) return null;

  const lpa = num >= 10000 ? num / 100000 : num;
  // Round to 1 decimal, strip trailing zero
  return lpa.toFixed(1).replace(/\.0$/, "");
}

function formatCtc(v: unknown): string {
  if (v == null) return "-";

  // If it's a plain number, normalize it
  if (typeof v === "number" || typeof v === "string") {
    const lpa = normalizeToLpa(v);
    return lpa ? `${lpa}L` : String(v);
  }

  if (typeof v === "object" && v !== null) {
    const obj = v as Record<string, unknown>;
    const parts: string[] = [];

    const fixed = normalizeToLpa(obj.fixed);
    const variable = normalizeToLpa(obj.variable);
    const min = normalizeToLpa(obj.min);
    const max = normalizeToLpa(obj.max);

    if (fixed && variable) {
      parts.push(`${fixed}L + ${variable}L variable`);
    } else if (fixed) {
      parts.push(`${fixed}L fixed`);
    }

    if (min && max && min === max) {
      parts.push(`${min}L`);
    } else if (min && max) {
      parts.push(`${min}-${max}L`);
    } else if (min) {
      parts.push(`Min: ${min}L`);
    } else if (max) {
      parts.push(`Max: ${max}L`);
    }

    if (obj.esops) parts.push(`ESOPs: ${obj.esops}`);
    if (obj.bonus) parts.push(`Bonus: ${obj.bonus}`);

    return parts.join(" - ") || "-";
  }

  return String(v);
}

export function ExtractedData({ data }: { data: ExtractedData }) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <p className="text-[13px] text-dark-text-muted">No data extracted yet</p>
    );
  }

  // Filter to only known fields with values
  const entries = Object.entries(data).filter(
    ([key, value]) => FIELD_CONFIG[key] && value !== null && value !== undefined && value !== ""
  );

  if (entries.length === 0) {
    return (
      <p className="text-[13px] text-dark-text-muted">No data extracted yet</p>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map(([key, value]) => {
        const config = FIELD_CONFIG[key];
        const Icon = config.icon;
        const displayValue = config.format ? config.format(value) : String(value);

        return (
          <div
            key={key}
            className="row-item flex items-start gap-3 rounded-xl p-3"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.05]">
              <Icon className="h-4 w-4 text-accent" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-normal uppercase tracking-[0.1em] text-dark-text-muted">
                {config.label}
              </p>
              <p className="mt-0.5 text-[13px] font-medium text-dark-text break-words">
                {displayValue}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
