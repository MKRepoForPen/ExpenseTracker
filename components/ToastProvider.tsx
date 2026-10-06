"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type ToastKind = "success" | "error" | "info";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  action?: { label: string; onClick: () => void };
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind, action?: Toast["action"]) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const KIND_STYLES: Record<ToastKind, { ring: string; icon: string; iconBg: string }> = {
  success: { ring: "ring-emerald-200", icon: "✓", iconBg: "bg-emerald-100 text-emerald-700" },
  error: { ring: "ring-rose-200", icon: "!", iconBg: "bg-rose-100 text-rose-700" },
  info: { ring: "ring-slate-200", icon: "i", iconBg: "bg-slate-100 text-slate-700" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback<ToastContextValue["toast"]>(
    (message, kind = "success", action) => {
      const id = nextId.current++;
      setToasts((t) => [...t.slice(-2), { id, kind, message, action }]);
      setTimeout(() => dismiss(id), action ? 6000 : 3500);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end"
      >
        {toasts.map((t) => {
          const s = KIND_STYLES[t.kind];
          return (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto flex w-full max-w-sm animate-slide-up items-center gap-3 rounded-xl bg-white p-3 shadow-lg ring-1 ${s.ring}`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${s.iconBg}`}
              >
                {s.icon}
              </span>
              <p className="flex-1 text-sm text-slate-700">{t.message}</p>
              {t.action && (
                <button
                  onClick={() => {
                    t.action!.onClick();
                    dismiss(t.id);
                  }}
                  className="rounded-md px-2 py-1 text-sm font-semibold text-brand-600 hover:bg-brand-50"
                >
                  {t.action.label}
                </button>
              )}
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
