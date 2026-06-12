import { useState, useCallback, createContext, useContext } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

interface ConfirmOptions {
  title?: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
}

interface ConfirmDialogState extends ConfirmOptions {
  open: boolean;
  resolve: ((value: boolean) => void) | null;
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | null>(null);

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used within a ConfirmDialogProvider");
  }
  return context.confirm;
}

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmDialogState>({
    open: false,
    description: "",
    resolve: null,
  });

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        ...options,
        open: true,
        resolve,
      });
    });
  }, []);

  const handleAction = useCallback((confirmed: boolean) => {
    state.resolve?.(confirmed);
    setState((prev) => ({ ...prev, open: false, resolve: null }));
  }, [state.resolve]);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <AlertDialog open={state.open} onOpenChange={(open) => {
        if (!open) handleAction(false);
      }}>
        <AlertDialogContent className="max-w-[90vw] sm:max-w-lg" data-testid="confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="confirm-dialog-title">
              {state.title || "Are you sure?"}
            </AlertDialogTitle>
            <AlertDialogDescription data-testid="confirm-dialog-description">
              {state.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => handleAction(false)}
              data-testid="confirm-dialog-cancel"
            >
              {state.cancelText || "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleAction(true)}
              className={state.variant === "destructive" ? "bg-red-600 hover:bg-red-700 text-white" : ""}
              data-testid="confirm-dialog-confirm"
            >
              {state.confirmText || "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}
