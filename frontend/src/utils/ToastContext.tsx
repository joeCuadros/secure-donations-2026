import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle, Info, X, XCircle } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast debe utilizarse dentro de ToastProvider.");
  return context;
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const removeToast = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType) => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, message, type }]);
    timers.current.set(
      id,
      setTimeout(() => removeToast(id), 4000)
    );
  }, [removeToast]);

  useEffect(() => () => {
    timers.current.forEach((timer) => clearTimeout(timer));
    timers.current.clear();
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-3 bottom-3 z-50 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-4 sm:w-full sm:max-w-sm"
        aria-live="polite"
        aria-relevant="additions"
      >
        {toasts.map((item) => {
          const Icon =
            item.type === "success"
              ? CheckCircle
              : item.type === "error"
                ? XCircle
                : Info;
          const colorClass =
            item.type === "success"
              ? "bg-emerald-600"
              : item.type === "error"
                ? "bg-red-600"
                : "bg-blue-600";

          return (
            <div
              key={item.id}
              role={item.type === "error" ? "alert" : "status"}
              className={`pointer-events-auto flex w-full items-center gap-3 rounded-xl px-4 py-3 text-white shadow-lg ${colorClass}`}
            >
              <Icon size={20} className="shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1 break-words text-sm font-medium">
                {item.message}
              </span>
              <button
                type="button"
                onClick={() => removeToast(item.id)}
                aria-label="Cerrar notificación"
                className="shrink-0 rounded-lg p-1 transition hover:bg-white/15"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
