import { Component, type ReactNode } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "./ui/button";
import { EmptyState } from "./ui/primitives";
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="page">
        <EmptyState
          icon={TriangleAlert}
          tone="crit"
          title="Não foi possível abrir este módulo"
          action={
            <Button onClick={() => location.reload()}>
              <RefreshCw size={15} />
              Recarregar
            </Button>
          }
        >
          Recarregue para tentar novamente. Seus dados no servidor não foram
          alterados.
        </EmptyState>
      </div>
    ) : (
      this.props.children
    );
  }
}
