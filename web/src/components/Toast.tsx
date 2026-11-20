import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";

export type ToastType = "info" | "success" | "error";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  notify: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const currentTimers = timers.current;
    return () => {
      for (const timer of currentTimers) window.clearTimeout(timer);
    };
  }, []);

  const notify = useCallback((message: string, type: ToastType = "info") => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, message, type }]);
    const timer = window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4_000);
    timers.current.push(timer);
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`} role="status">
            <span className="toast-dot" />
            <span>{toast.message}</span>
            <button
              type="button"
              className="toast-close"
              aria-label="Cerrar"
              onClick={() =>
                setToasts((current) => current.filter((item) => item.id !== toast.id))
              }
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
