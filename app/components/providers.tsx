"use client";

import { ToastProvider } from "@/app/components/ui/toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
