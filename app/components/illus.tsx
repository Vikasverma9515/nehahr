/* eslint-disable @next/next/no-img-element */

/**
 * Open Peeps character illustrations (openpeeps.com, by Pablo Stanley, CC0 1.0), optimised into
 * /public/peeps/illus. Import more with `node scripts/import-illustrations.mjs <folder>`.
 *
 * Small round faces (lists, avatars) live in app/components/peep.tsx and person-avatar.tsx.
 */
export const STANDING = Array.from({ length: 30 }, (_, i) => `standing-${i + 1}` as const);
export const SITTING = [1, 2, 4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 17, 18].map((n) => `sitting-${n}` as const);
export const BUSTS = [
  3, 4, 5, 7, 8, 9, 10, 14, 15, 17, 22, 24, 30, 31, 32, 33, 36, 37, 38, 40, 41, 44, 46, 47, 48, 49, 50, 54, 58, 62, 65, 66, 67, 71, 73, 74, 75, 79, 81,
  83, 86, 88, 96, 97, 99, 100, 101, 102, 105,
].map((n) => `bust-${n}` as const);

export type IllusName = (typeof STANDING)[number] | (typeof SITTING)[number] | (typeof BUSTS)[number];

/** A character illustration, sized by height, with an optional soft violet glow behind it. */
export function Illus({
  name,
  height = 240,
  className = "",
  glow = true,
  flip = false,
}: {
  name: IllusName;
  height?: number;
  className?: string;
  glow?: boolean;
  flip?: boolean;
}) {
  return (
    <span className={`inline-block ${className}`} style={{ height }} aria-hidden="true">
      <span className="relative block h-full">
        {glow && (
          <span
            className="pointer-events-none absolute left-1/2 top-1/2 h-[120%] w-[190%] -translate-x-1/2 -translate-y-1/2"
            style={{ background: "radial-gradient(closest-side, rgba(139,92,246,0.42), rgba(139,92,246,0.12) 55%, transparent 100%)" }}
          />
        )}
        <img
          src={`/peeps/illus/${name}.svg`}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          className="relative block h-full w-auto select-none"
          style={flip ? { transform: "scaleX(-1)" } : undefined}
        />
      </span>
    </span>
  );
}

/** One character on each side of a centred section heading (large screens only). */
export function SideIllus({
  left,
  right,
  height = 190,
  wide = false,
}: {
  left: IllusName;
  right: IllusName;
  height?: number;
  wide?: boolean;
}) {
  return (
    <div className={`pointer-events-none absolute bottom-0 top-0 hidden items-end justify-between lg:flex ${wide ? "-inset-x-24" : "inset-x-4"}`} aria-hidden="true">
      <Illus name={left} height={height} />
      <Illus name={right} height={height} flip />
    </div>
  );
}
