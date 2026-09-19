/* eslint-disable @next/next/no-img-element */

/**
 * Open Peeps avatars (art by Pablo Stanley, CC0 1.0), rendered with DiceBear and committed as
 * static SVGs in /public/peeps. Regenerate them with `npm run peeps`.
 */
export type PeepName =
  | "priya" | "rahul" | "amit" | "sneha" | "mia" | "noah" | "zoe" | "maya" | "ella" | "asha" | "vikas" | "finn"
  | "tess" | "cy" | "wes" | "rosa" | "dev" | "ivy" | "hana" | "neha" | "jon" | "ada" | "lars" | "aria";

/** The sample candidates used across the page keep the same face everywhere. */
const CANDIDATE_FACES: Record<string, PeepName> = {
  "Priya Patel": "priya",
  "Rahul Sharma": "rahul",
  "Amit Kumar": "amit",
  "Sneha Reddy": "sneha",
  "Meera Nair": "mia",
  "Karan Shah": "noah",
};

export const peepFor = (fullName: string): PeepName | undefined => CANDIDATE_FACES[fullName];

export function Peep({ name, size = 56, className = "", ring = "ring-dark-bg" }: { name: PeepName; size?: number; className?: string; ring?: string }) {
  return (
    <img
      src={`/peeps/${name}.svg`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={`shrink-0 select-none rounded-full bg-white/10 object-cover ring-2 ${ring} ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

/** Overlapping row of faces. */
export function PeepStack({ names, size = 40, ring = "ring-dark-card", className = "", overlap = 0.28 }: { names: PeepName[]; size?: number; ring?: string; className?: string; overlap?: number }) {
  return (
    <span className={`inline-flex items-center ${className}`} aria-hidden="true">
      {names.map((n, i) => (
        <span key={`${n}-${i}`} className="inline-flex" style={{ marginLeft: i ? -Math.round(size * overlap) : 0 }}>
          <Peep name={n} size={size} ring={ring} />
        </span>
      ))}
    </span>
  );
}

/** A face that bobs gently. Position it with absolute-position classes. */
export function FloatPeep({
  name,
  size = 80,
  className = "",
  delay = "0s",
  glow = false,
}: {
  name: PeepName;
  size?: number;
  className?: string;
  delay?: string;
  glow?: boolean;
}) {
  return (
    <span className={`peep-float absolute ${className}`} style={{ animationDelay: delay }} aria-hidden="true">
      <Peep
        name={name}
        size={size}
        ring="ring-white/15"
        className={`shadow-xl shadow-black/40 ${glow ? "shadow-accent/30" : ""}`}
      />
    </span>
  );
}

/** Two faces on each side of a centred section heading (large screens only). */
export function SideFaces({ left, right, wide = false, tight = false }: { left: [PeepName, PeepName]; right: [PeepName, PeepName]; wide?: boolean; tight?: boolean }) {
  const second = tight ? { size: 46, y: "top-14" } : { size: 56, y: "top-24" };
  return (
    <div className={`pointer-events-none absolute top-0 hidden h-44 justify-between lg:flex ${wide ? "-inset-x-24" : "inset-x-6"}`} aria-hidden="true">
      <div className="relative h-full w-44">
        <FloatPeep name={left[0]} size={76} className="left-2 top-2" delay="-1s" />
        <FloatPeep name={left[1]} size={second.size} className={`left-24 ${second.y}`} delay="-3.5s" />
      </div>
      <div className="relative h-full w-44">
        <FloatPeep name={right[0]} size={76} className="right-2 top-2" delay="-2.2s" />
        <FloatPeep name={right[1]} size={second.size} className={`right-24 ${second.y}`} delay="-4.4s" />
      </div>
    </div>
  );
}
