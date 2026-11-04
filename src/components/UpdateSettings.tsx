import { useEffect, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import type { UpdateStatus } from "../../electron/updatePolicy";
import { Button } from "./ui/button";

export default function UpdateSettings() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  useEffect(() => {
    const desktop = window.desktop;
    if (!desktop) return;
    let active = true;
    const receive = (value: UpdateStatus) => { if (active) setStatus(value); };
    const stop = desktop.onUpdateStatus(receive);
    void desktop.updateStatus().then(receive).catch(() => { if (active) setError("Não foi possível consultar as atualizações."); });
    return () => { active = false; stop(); };
  }, []);
  if (!window.desktop) return null;
  const busy = checking || !status || ["checking", "downloading", "installing"].includes(status.phase);
  const action = async (install: boolean) => {
    setError("");
    try {
      if (install) await window.desktop!.installUpdate();
      else {
        setChecking(true);
        // A consulta costuma durar menos de um segundo; mantém o retorno visível por um instante.
        const [next] = await Promise.all([window.desktop!.checkForUpdates(), new Promise((r) => setTimeout(r, 800))]);
        setStatus(next);
        setCheckedAt(new Date());
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível concluir a atualização."); }
    finally { setChecking(false); }
  };
  return (
    <section className="panel settings-section" aria-labelledby="updates-title">
      <div className="section-title">
        <span className="section-icon"><Download size={17} /></span>
        <div>
          <h2 id="updates-title">Atualizações do aplicativo</h2>
          <p>{status ? `Versão instalada: ${status.currentVersion}` : "Consultando versão instalada…"}</p>
        </div>
      </div>
      <p role="status">
        {checking ? "Verificando novas versões…" : status?.message}
        {!checking && checkedAt && status?.phase !== "downloading" ? ` Última verificação: ${checkedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.` : ""}
      </p>
      {status?.phase === "downloading" ? <progress aria-label="Download da atualização" max={100} value={status.percent || 0} /> : null}
      {error ? <p role="alert" className="inline-error">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="button" variant="outline" disabled={busy || status?.phase === "unavailable" || status?.phase === "ready"} onClick={() => void action(false)}>
          <RefreshCw size={16} className={checking ? "animate-spin" : undefined} /> {checking ? "Verificando…" : "Verificar atualizações"}
        </Button>
        {status?.phase === "ready" ? <Button type="button" onClick={() => void action(true)}>Reiniciar e atualizar</Button> : null}
      </div>
    </section>
  );
}
