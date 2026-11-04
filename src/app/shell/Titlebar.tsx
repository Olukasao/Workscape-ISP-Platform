import { Minus, Square, X } from "lucide-react";
import logo from "../../assets/brand/logo-acessanet.png";

/** Barra de título integrada: a janela Electron não tem moldura nativa. */
export function Titlebar() {
  return (
    <div
      className="titlebar"
      onDoubleClick={(e) => {
        if (e.target === e.currentTarget) void window.desktop?.window("maximize");
      }}
    >
      <span className="titlebar-brand">
        <span className="titlebar-globe" aria-hidden="true">
          <img src={logo} alt="" width={877} height={327} />
        </span>
        <span>
          <strong>AcessaNet</strong> Workspace
        </span>
      </span>
      <div className="titlebar-controls">
        {(
          [
            [Minus, "minimize", "Minimizar"],
            [Square, "maximize", "Maximizar ou restaurar"],
            [X, "close", "Fechar"],
          ] as const
        ).map(([Icon, action, label]) => (
          <button
            key={action}
            aria-label={label}
            title={label}
            className={action === "close" ? "is-close" : undefined}
            onClick={() => void window.desktop?.window(action)}
          >
            <Icon size={action === "maximize" ? 11 : 14} strokeWidth={1.6} />
          </button>
        ))}
      </div>
    </div>
  );
}
