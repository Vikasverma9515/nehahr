"use client";

import { useEffect, useState, createContext, useContext, useCallback } from "react";
import { CheckCircle2, XCircle, AlertCircle, X } from "lucide-react";

type ToastVariant = "success" | "error" | "info";

type Toast = {
  id: string;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  toast: (message: string, variant?: ToastVariant) => void;
};

const ToastContext = createContext<ToastContextValue>({
  toast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, variant: ToastVariant = "success") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, variant }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2">
          {toasts.map((t) => (
            <ToastItem
              key={t.id}
              toast={t}
              onDismiss={() => setToasts((ts) => ts.filter((x) => x.id !== t.id))}
            />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

function ToastItem({ toast: t, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const tid = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(tid);
  }, []);

  const Icon =
    t.variant === "success" ? CheckCircle2 :
    t.variant === "error" ? XCircle :
    AlertCircle;

  const colors = {
    success: "border-[#7dd4a8]/20 bg-[#7dd4a8]/[0.08] text-[#7dd4a8]",
    error: "border-[#e8908a]/20 bg-[#e8908a]/[0.08] text-[#e8908a]",
    info: "border-accent/20 bg-accent/[0.08] text-accent",
  };

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-[13px] font-medium shadow-lg transition-all duration-300 ${colors[t.variant]} ${
        visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{t.message}</span>
      <button onClick={onDismiss} className="ml-1 opacity-60 hover:opacity-100">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
