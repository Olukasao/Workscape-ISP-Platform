import { useState } from "react";
import { CircleAlert, CircleCheck, LoaderCircle, Wrench } from "lucide-react";
import { Button } from "./ui/button";

type Resultado = {
  linhas: { servico: string; host: string; porta: number; ok: boolean; ms: number; erro?: string }[];
  rede: string | null;
  vpns: { nome: string; servidor: string; tipo: string; tunelDividido: boolean; conectada: boolean; temRota: boolean }[];
  conflito: string | null;
  windows: boolean;
};

/** Testa se o computador alcança cada servidor e, no Windows, corrige a rota da VPN que costuma faltar fora do escritório. */
export default function DiagnosticoConexao() {
  const [testando, setTestando] = useState(false);
  const [r, setR] = useState<Resultado | null>(null);
  const [corrigindo, setCorrigindo] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const desktop = window.desktop;
  if (!desktop?.testarConexao) return null;

  const testar = async () => {
    setTestando(true); setAviso(null);
    try { setR(await desktop.testarConexao!()); } catch { setAviso({ ok: false, texto: "Não foi possível testar a conexão agora." }); } finally { setTestando(false); }
  };
  const corrigir = async () => {
    setCorrigindo(true);
    try {
      const x = await desktop.corrigirVpn!();
      setAviso({ ok: x.ok, texto: x.mensagem });
    } catch { setAviso({ ok: false, texto: "Não foi possível corrigir a VPN." }); } finally { setCorrigindo(false); }
  };

  const falhou = r ? r.linhas.some((l) => !l.ok) : false;
  const vpnSemRota = r?.vpns.some((v) => v.tunelDividido && !v.temRota) ?? false;
  return (
    <div className="diag-conexao">
      <div className="diag-conexao-acoes">
        <Button type="button" variant="outline" size="sm" onClick={testar} disabled={testando}>
          {testando ? <LoaderCircle size={15} className="girando" aria-hidden="true" /> : <CircleCheck size={15} aria-hidden="true" />}
          {testando ? "Testando…" : "Testar conexão com os servidores"}
        </Button>
      </div>
      {r ? (
        <ul className="diag-conexao-lista" aria-label="Resultado do teste">
          {r.linhas.map((l) => (
            <li key={l.servico} className={l.ok ? "ok" : "falha"}>
              {l.ok ? <CircleCheck size={16} aria-hidden="true" /> : <CircleAlert size={16} aria-hidden="true" />}
              <span><strong>{l.servico}</strong><small>{l.host}:{l.porta}</small></span>
              <em>{l.ok ? `${l.ms} ms` : l.erro}</em>
            </li>
          ))}
        </ul>
      ) : null}
      {r && !falhou ? <p className="diag-conexao-ok">Tudo certo: este computador alcança todos os servidores.</p> : null}
      {r && falhou ? (
        <div className="diag-conexao-ajuda">
          <p><strong>Não consegui alcançar {r.linhas.filter((l) => !l.ok).length === r.linhas.length ? "nenhum servidor" : "alguns servidores"}.</strong> Confira se a VPN está conectada.</p>
          {r.conflito ? <p>A rede do adaptador “{r.conflito}” usa a mesma faixa do escritório ({r.rede}). Enquanto isso for verdade, a VPN não consegue levar o tráfego: peça ao TI para trocar a faixa do roteador de casa.</p> : null}
          {r.windows && vpnSemRota ? (
            <>
              <p>A VPN do Windows {r.vpns.filter((v) => v.tunelDividido && !v.temRota).map((v) => `“${v.nome}”`).join(", ")} não tem a rota para a rede do escritório ({r.rede}).</p>
              <Button type="button" size="sm" onClick={corrigir} disabled={corrigindo}>
                {corrigindo ? <LoaderCircle size={15} className="girando" aria-hidden="true" /> : <Wrench size={15} aria-hidden="true" />}
                {corrigindo ? "Corrigindo…" : "Corrigir a VPN"}
              </Button>
            </>
          ) : null}
          {r.windows && r.vpns.length === 0 ? <p>Não achei nenhuma VPN do Windows neste usuário. Se você usa outro programa de VPN, o TI precisa liberar a rota {r.rede ?? "da rede do escritório"} nele.</p> : null}
        </div>
      ) : null}
      {aviso ? <p className={aviso.ok ? "diag-conexao-ok" : "inline-error"} role="status">{aviso.texto}</p> : null}
    </div>
  );
}
