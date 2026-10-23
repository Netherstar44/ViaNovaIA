import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Last-resort UI guard. Without it, any uncaught render error unmounts the
 * whole React tree and leaves an empty body (which looked like a "dark screen"
 * when a dark palette was active). The fallback always keeps a way back.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ViaNovaIA render error:", error, info.componentStack);
  }

  private reload = () => {
    window.location.reload();
  };

  private resetSession = () => {
    try {
      localStorage.removeItem("user");
      localStorage.removeItem("auth_token");
    } catch {
      // ignore storage restrictions
    }
    window.location.href = "/login";
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background px-6 text-center text-foreground">
        <div className="max-w-md space-y-2">
          <h1 className="font-heading text-2xl font-bold">Algo salió mal</h1>
          <p className="text-sm text-muted-foreground">
            La página encontró un error inesperado. Puedes reintentar o restablecer la sesión local.
          </p>
          {import.meta.env.DEV && (
            <pre className="mt-3 max-h-32 overflow-auto rounded-lg bg-muted p-3 text-left text-xs text-muted-foreground">
              {error.message}
            </pre>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={this.reload}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow hover:opacity-90"
          >
            Reintentar
          </button>
          <button
            type="button"
            onClick={this.resetSession}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
          >
            Restablecer sesión
          </button>
        </div>
      </div>
    );
  }
}
