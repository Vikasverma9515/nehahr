import { Illus } from "@/app/components/illus";

/** Sign-in and sign-up sit between two Open Peeps characters on wide screens. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden items-end justify-between px-[6vw] lg:flex" aria-hidden="true">
        <Illus name="standing-9" height={420} />
        <Illus name="standing-12" height={400} flip />
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}
