import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ClipboardList, Globe, Headset, LoaderCircle, Network, RefreshCw } from "lucide-react";
import { api, errorMessage } from "../services/api";
import { Button } from "../components/ui/button";
import { PageHeader, EmptyState, Skeleton } from "../components/ui/primitives";
import styles from "../styles/Chamados.module.css";

interface ChamadoSite {
  activityId: number;
  protocol: string | null;
  customerName: string | null;
  cpfMasked: string | null;
  title: string;
  openedAt: string;
  status: string;
  statusLabel: string;
}
interface ChamadoSiteDetalhe extends ChamadoSite {
  description: string | null;
  closureReason: string | null;
  closedAt: string | null;
  contractId: string;
}
interface ListaChamadosSite { items: ChamadoSite[]; page: number; limit: number; total: number; truncated: boolean }

// Categorias do SGP: não existe API do SGP que liste chamados de todas as
// categorias (só por contrato individual), então aqui abre o relatório real
// do próprio SGP no navegador — mesma origem que já usamos em outros lugares
// do Workspace (electron/sgpReports.ts).
const CATEGORIAS_SGP: { key: "sgp-suporte-tecnico" | "sgp-n1" | "sgp-n2" | "sgp-n3"; label: string }[] = [
  { key: "sgp-suporte-tecnico", label: "Suporte Técnico" },
  { key: "sgp-n1", label: "N1" },
  { key: "sgp-n2", label: "N2" },
  { key: "sgp-n3", label: "N3" },
];

const formatarData = (v: string | null) => (v ? new Date(v).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—");

function ChamadosDoSite() {
  const [pagina, setPagina] = useState(1);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const limite = 25;
  const lista = useQuery({
    queryKey: ["chamados", "site", pagina],
    queryFn: async () => (await api.get<ListaChamadosSite>("/chamados/site", { params: { period: "30d", page: pagina, limit: limite } })).data,
  });
  const detalhe = useQuery({
    queryKey: ["chamados", "site", "detalhe", selecionado],
    enabled: !!selecionado,
    queryFn: async () => (await api.get<ChamadoSiteDetalhe>(`/chamados/site/${selecionado}`)).data,
  });

  if (selecionado) {
    return (
      <section className="panel" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Button type="button" variant="ghost" size="sm" onClick={() => setSelecionado(null)} style={{ width: "fit-content" }}>
          <ArrowLeft size={14} /> Voltar à lista
        </Button>
        {detalhe.isLoading ? (
          <Skeleton lines={5} />
        ) : detalhe.error ? (
          <p role="alert" className="form-error">{errorMessage(detalhe.error)}</p>
        ) : detalhe.data ? (
          <>
            <h2>{detalhe.data.title}</h2>
            <p className="muted">
              {detalhe.data.customerName || "Cliente"} {detalhe.data.cpfMasked ? `· ${detalhe.data.cpfMasked}` : ""} · Protocolo {detalhe.data.protocol || "—"}
            </p>
            <p><strong>Situação:</strong> {detalhe.data.statusLabel}</p>
            <p><strong>Aberto em:</strong> {formatarData(detalhe.data.openedAt)}</p>
            {detalhe.data.closedAt && <p><strong>Encerrado em:</strong> {formatarData(detalhe.data.closedAt)}</p>}
            {detalhe.data.description && <p style={{ whiteSpace: "pre-wrap" }}>{detalhe.data.description}</p>}
            {detalhe.data.closureReason && <p className="muted">Motivo do encerramento: {detalhe.data.closureReason}</p>}
          </>
        ) : null}
      </section>
    );
  }

  return (
    <section className="panel" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {lista.isLoading ? (
        <Skeleton lines={6} />
      ) : lista.error ? (
        <EmptyState icon={ClipboardList} title="Não foi possível carregar">{errorMessage(lista.error)}</EmptyState>
      ) : !lista.data?.items.length ? (
        <EmptyState icon={ClipboardList} title="Nenhum chamado pelo site nos últimos 30 dias" />
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Protocolo</th><th>Cliente</th><th>Assunto</th><th>Situação</th><th>Aberto em</th></tr>
              </thead>
              <tbody>
                {lista.data.items.map((c) => (
                  <tr key={c.activityId} onClick={() => setSelecionado(c.protocol)} style={{ cursor: c.protocol ? "pointer" : "default" }}>
                    <td>{c.protocol || "—"}</td>
                    <td>{c.customerName || "—"}</td>
                    <td>{c.title}</td>
                    <td>{c.statusLabel}</td>
                    <td>{formatarData(c.openedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Button type="button" size="sm" variant="outline" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Anterior</Button>
            <span className="muted">Página {pagina}</span>
            <Button type="button" size="sm" variant="outline" disabled={pagina * limite >= (lista.data?.total || 0)} onClick={() => setPagina((p) => p + 1)}>Próxima</Button>
          </div>
        </>
      )}
    </section>
  );
}

function ChamadosDoSgp() {
  const navigate = useNavigate();
  const [categoria, setCategoria] = useState<(typeof CATEGORIAS_SGP)[number] | null>(null);
  // O SGP não tem API de lista por categoria (só por contrato individual): a
  // lista aqui vem de ler, por trás, a mesma página de relatório que o
  // Navegador > SGP já abre — usa a sessão de quem já logou lá.
  const resultado = useQuery({
    queryKey: ["chamados", "sgp", categoria?.key],
    enabled: !!categoria,
    queryFn: async () => window.desktop!.sgpListarChamados(categoria!.key),
  });

  const carregando = resultado.isLoading || resultado.isFetching;
  return (
    <section className="panel" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {CATEGORIAS_SGP.map((c) => (
          <Button key={c.key} type="button" variant={categoria?.key === c.key ? "default" : "outline"} onClick={() => setCategoria(c)}>
            <Headset size={14} /> {c.label}
          </Button>
        ))}
        {categoria && (
          <Button type="button" size="sm" variant="ghost" disabled={carregando} onClick={() => void resultado.refetch()}>
            {carregando ? <LoaderCircle size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Atualizar
          </Button>
        )}
      </div>
      {!categoria ? (
        <EmptyState icon={Headset} title="Escolha uma fila" />
      ) : carregando ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <LoaderCircle size={16} className="animate-spin" />
          <span className="muted">Lendo os chamados no SGP...</span>
        </div>
      ) : resultado.error ? (
        <EmptyState icon={Headset} title="Não foi possível ler os chamados do SGP">{errorMessage(resultado.error)}</EmptyState>
      ) : resultado.data && !resultado.data.autenticado ? (
        <EmptyState icon={Headset} title="Faça login no SGP primeiro">
          <p>
            O login do Chrome/Edge do computador não vale aqui: é preciso entrar pelo
            Navegador do próprio Workspace (ele tem uma sessão só dele). Uma vez só por computador.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button type="button" onClick={() => navigate("/navegador")}>
              <Network size={14} /> Abrir Navegador &gt; SGP para entrar
            </Button>
            <Button type="button" variant="outline" onClick={() => void resultado.refetch()}>
              <RefreshCw size={14} /> Já entrei, tentar de novo
            </Button>
          </div>
        </EmptyState>
      ) : !resultado.data?.linhas.length ? (
        <EmptyState icon={Headset} title={`Nenhum chamado em ${categoria.label} agora`} />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>{resultado.data.colunas.map((c, i) => <th key={i}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {resultado.data.linhas.map((linha, i) => (
                <tr
                  key={i}
                  style={{ cursor: linha.link ? "pointer" : "default" }}
                  onClick={() => { if (linha.link) void window.desktop?.openSgpLink(linha.link); }}
                >
                  {linha.colunas.map((valor, j) => <td key={j}>{valor}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function Chamados() {
  const [aba, setAba] = useState<"site" | "sgp">("site");
  return (
    <div className="page chamados-page">
      <PageHeader icon={ClipboardList} title="Chamados" description="Chamados abertos pelo site e pelas filas de suporte do SGP." />
      <div className="segmented segmented--fill" style={{ maxWidth: 360 }}>
        <button type="button" aria-pressed={aba === "site"} onClick={() => setAba("site")}>
          <Globe size={14} /> Pelo site
        </button>
        <button type="button" aria-pressed={aba === "sgp"} onClick={() => setAba("sgp")}>
          <Headset size={14} /> SGP
        </button>
      </div>
      {aba === "site" ? <ChamadosDoSite /> : <ChamadosDoSgp />}
    </div>
  );
}
