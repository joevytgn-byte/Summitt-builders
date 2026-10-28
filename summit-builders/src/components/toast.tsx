"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Check, Info, TriangleAlert, X } from "lucide-react";

type ToastTone = "success" | "error" | "info";
type Toast = { id: string; title: string; description?: string; tone: ToastTone };

const ToastContext = createContext<{ push: (t: { title: string; description?: string; tone?: ToastTone }) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((t: { title: string; description?: string; tone?: ToastTone }) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev.slice(-3), { id, tone: t.tone ?? "success", title: t.title, description: t.description }]);
    setTimeout(() => dismiss(id), 4600);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast" data-tone={t.tone} role="status">
            <span className="mt-0.5 shrink-0 text-white/80">
              {t.tone === "success" ? <Check size={16} /> : t.tone === "error" ? <TriangleAlert size={16} /> : <Info size={16} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="toast-title">{t.title}</div>
              {t.description && <div className="toast-desc">{t.description}</div>}
            </div>
            <button onClick={() => dismiss(t.id)} className="text-white/45 hover:text-white" aria-label="Dismiss notification">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) return { push: () => undefined };
  return ctx;
}
