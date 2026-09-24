"use client";

import React, { createContext, useContext, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

export function Toast({
  message,
  type = "success",
  onClose,
}: {
  message: string;
  type?: ToastType;
  onClose: () => void;
}) {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex items-center justify-between p-4 rounded-xl shadow-lg border bg-white max-w-sm w-full animate-in fade-in slide-in-from-bottom-5 duration-200">
      <div className="flex gap-3 items-center">
        {type === "success" && <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />}
        {type === "error" && <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />}
        {type === "info" && <Info className="h-5 w-5 text-blue-600 shrink-0" />}
        <p className="text-xs font-semibold text-[#2B2B2E]">{message}</p>
      </div>
      <button
        onClick={onClose}
        className="text-[#2B2B2E]/40 hover:text-[#2B2B2E] transition ml-2 cursor-pointer"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

interface ToastContextType {
  showToast: (title: string, message?: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (title: string, message?: string, type: ToastType = "success") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, title, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start justify-between p-4 rounded-xl shadow-lg border transition-all animate-in fade-in slide-in-from-bottom-5 duration-200 ${
              toast.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : toast.type === "error"
                ? "bg-red-50 border-red-200 text-red-900"
                : "bg-blue-50 border-blue-200 text-blue-900"
            }`}
          >
            <div className="flex gap-3 items-start">
              {toast.type === "success" && <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />}
              {toast.type === "error" && <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />}
              {toast.type === "info" && <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />}
              <div>
                <h4 className="text-xs font-bold">{toast.title}</h4>
                {toast.message && <p className="text-xs opacity-90 mt-0.5">{toast.message}</p>}
              </div>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-[#2B2B2E]/40 hover:text-[#2B2B2E] transition ml-2"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
