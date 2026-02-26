import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { cn } from '../utils/cn';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const idCounter = useRef(0);

    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = `toast-${++idCounter.current}`;
        setToasts(prev => [...prev, { id, message, type }]);
    }, []);

    const dismiss = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
                {toasts.map(toast => (
                    <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
                ))}
            </div>
        </ToastContext.Provider>
    );
};

const ToastItem = ({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) => {
    useEffect(() => {
        const timer = setTimeout(() => onDismiss(toast.id), 3500);
        return () => clearTimeout(timer);
    }, [toast.id, onDismiss]);

    const Icon = toast.type === 'success' ? CheckCircle2 : toast.type === 'error' ? XCircle : Info;

    return (
        <div
            className={cn(
                "pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm",
                "animate-in slide-in-from-right-5 fade-in duration-300 min-w-[260px] max-w-[380px]",
                toast.type === 'success' && "bg-emerald-500/10 border-emerald-500/20 text-emerald-300",
                toast.type === 'error' && "bg-red-500/10 border-red-500/20 text-red-300",
                toast.type === 'info' && "bg-neutral-800 border-white/10 text-neutral-200",
            )}
        >
            <Icon size={18} className="flex-shrink-0" />
            <span className="text-sm font-medium flex-1">{toast.message}</span>
            <button
                onClick={() => onDismiss(toast.id)}
                className="flex-shrink-0 p-0.5 rounded hover:bg-white/10 transition-colors"
            >
                <X size={14} />
            </button>
        </div>
    );
};
