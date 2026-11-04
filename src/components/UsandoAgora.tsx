import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MonitorSmartphone, RefreshCw } from "lucide-react";
import { api, errorMessage } from "../services/api";
import { socket } from "../services/socket";
import { Avatar, Badge } from "./ui/primitives";

// Painel de administração: quem está com o aplicativo Acessa Workspace aberto agora e em qual versão.
interface Online {
  id: number;
  nome: string;
  email: string;
  avatar?: string | null;
  setor_nome?: string | null;
  versao: string | null;
  desde: string;
  janelas: number;
}

const comparar = (a: string, b: string) => {
  const pa = a.split(".").map(Number), pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
};
const tempo = (iso: string) => {
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (min < 1) return "agora há pouco";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  return `há ${h} h${min % 60 ? ` ${min % 60} min` : ""}`;
};

export default function UsandoAgora() {
  const query = useQueryClient();
  const lista = useQuery({
    queryKey: ["admin", "workspace-online"],
    queryFn: async () => (await api.get<Online[]>("/admin/workspace/online")).data,
    refetchInterval: 30000,
  });
  // Atualiza na hora quando alguém abre ou fecha o aplicativo.
  useEffect(() => {
    const s = socket;
    const mudou = () => void query.invalidateQueries({ queryKey: ["admin", "workspace-online"] });
    s.on("workspace_presence_changed", mudou);
    return () => { s.off("workspace_presence_changed", mudou); };
  }, [query]);

  const pessoas = lista.data || [];
  // Versão mais nova vista entre quem está conectado: quem está abaixo dela aparece como desatualizado.
  const maisNova = useMemo(
    () => pessoas.map((p) => p.versao).filter((v): v is string => !!v).sort(comparar).pop() || null,
    [pessoas],
  );
  const desatualizados = pessoas.filter((p) => p.versao && maisNova && comparar(p.versao, maisNova) < 0).length;

  return (
    <section className="panel usando-agora" aria-labelledby="usando-agora-titulo">
      <header>
        <div>
          <h2 id="usando-agora-titulo"><MonitorSmartphone size={18} /> Usando o aplicativo agora</h2>
          <p className="muted">
            {lista.isLoading
              ? "Carregando…"
              : `${pessoas.length} ${pessoas.length === 1 ? "pessoa" : "pessoas"} com o Workspace aberto`}
            {desatualizados ? ` · ${desatualizados} em versão antiga` : ""}
          </p>
        </div>
        <button type="button" className="icon-button" aria-label="Atualizar lista" onClick={() => void lista.refetch()}>
          <RefreshCw size={16} className={lista.isFetching ? "animate-spin" : ""} />
        </button>
      </header>
      {lista.isError ? <p role="alert" className="form-error">{errorMessage(lista.error)}</p> : null}
      {!lista.isLoading && !pessoas.length && !lista.isError ? (
        <p className="muted">Ninguém com o aplicativo aberto no momento. Quem usa versões anteriores à 0.5.17 ainda não aparece aqui.</p>
      ) : null}
      <ul>
        {pessoas.map((p) => {
          const antiga = !!(p.versao && maisNova && comparar(p.versao, maisNova) < 0);
          return (
            <li key={p.id}>
              <Avatar name={p.nome} src={p.avatar} size="sm" />
              <span className="usando-agora-nome">
                <strong>{p.nome}</strong>
                <small className="muted">{p.setor_nome || p.email}</small>
              </span>
              <span className="usando-agora-meta">
                {p.versao ? <Badge tone={antiga ? "warn" : "ok"}>v{p.versao}{antiga ? " · antiga" : ""}</Badge> : null}
                <small className="muted" title={new Date(p.desde).toLocaleString("pt-BR")}>
                  aberto {tempo(p.desde)}{p.janelas > 1 ? ` · ${p.janelas} conexões` : ""}
                </small>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
