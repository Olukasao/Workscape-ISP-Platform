import { Headset, HardHat, Radar, ShoppingCart, Warehouse } from "lucide-react";
import { reconectarDashboard, useDashboard } from "../services/dashboard";
import { countTone, groupTotal, networkStatus } from "../services/dashboardModel";
import { propsRelatorio } from "../services/sgpLinks";
import logo from "../assets/brand/logo-acessanet.png";
import "../styles/dashboard.css";

// Primeiro layout do Painel NOC (o antigo.html, "visão resumida"): mesmos cartões, ordem e regras de cor.
const fmt = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("pt-BR"));
const horario = (iso?: string | null) =>
  iso && Number.isFinite(Date.parse(iso))
    ? new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : "--:--:--";
const EMOJI: Record<string, string> = { ok: "🟢", warning: "🟡", critical: "🔴", waiting: "⚪" };

const CHAMADOS_1: [string, string, string?][] = [
  ["SUPORTE TÉCNICO", "Suporte Técnico"],
  ["SUPORTE N1", "Suporte N1"],
  ["SUPORTE N2", "Suporte N2"],
  ["SUPORTE N3", "Suporte N3"],
  ["BAIXA", "Baixa", "baixa"],
  ["REGULAR", "Regular", "media"],
  ["ALTA", "Alta", "alta"],
];
const CHAMADOS_2_ANTES: [string, string][] = [
  ["OFFLINE", "Offline"],
  ["ROTEADOR", "Roteador"],
  ["ATENUAÇÃO", "Atenuação"],
];
const CHAMADOS_2_DEPOIS: [string, string][] = [
  ["RETIRADA DE EQUIPAMENTO", "Retirada de Equipamento"],
  ["RETIRADA DE EQUIPAMENTO - SUSPENSOS", "Retirada de Equipamento Suspensos"],
  ["ATIVAÇÃO DE CONTRATO - COMUM", "Instalação"],
  ["ATIVAÇÃO DE CONTRATO - MUDANÇA DE ENDEREÇO", "Mudança de Endereço"],
  ["MUDANÇA DE PONTO INTERNO", "Mudança de Ponto interno"],
  ["RETENÇÃO", "Retenção"],
];
const MASSIVOS: [string, string][] = ["MRT", "DAS", "SRP", "PV", "LRJ"].map((r) => [`BACKBONE GPON ACESSANET | ${r}`, `Backbone Gpon ${r}`]);
const COMERCIAL: [string, string][] = [
  ["ATIVAÇÃO DE CONTRATO - COMUM", "Vendas"],
  ["COMERCIAL CONTRATAÇÃO", "Comercial Contratação"],
  ["COMERCIAL PENDENTE DOC", "Comercial Pendente DOC"],
  ["FINANCEIRO", "Financeiro"],
  ["CANCELAMENTO CONTRATO", "Cancelamentos"],
  ["ACORDO/ NEGOCIAÇÃO", "Acordo Negociação"],
  ["CONGELAMENTO", "Congelamento"],
  ["PROCON", "Procon"],
  ["ANATEL", "Anatel"],
  ["RECLAME AQUI", "Reclame aqui"],
];

export default function DashboardResumido({ onOpenRunning }: { onOpenRunning: () => void }) {
  const { snapshot, customers, customersUpdated, connected, detail, status } = useDashboard();
  const groups = snapshot?.groups || null;
  const rede = networkStatus(groups);
  const atual =
    customers && [customers.ativos, customers.reduzido, customers.suspensos].every((v) => v !== null)
      ? customers.ativos! + customers.reduzido! + customers.suspensos!
      : null;
  const clientes: [string, number | null | undefined][] = [
    ["⚪ Total de Clientes", customers?.total],
    ["🔵 Total atualmente:", atual],
    ["🟢 Clientes Ativos", customers?.ativos],
    ["🟠 Clientes Suspensos", customers?.suspensos],
    ["🔴 Clientes Cancelados", customers?.cancelados],
  ];
  const cartao = (key: string, label: string, extra?: string, classe = "chamado-card") => {
    const valor = groupTotal(groups, key);
    const tom = countTone(valor, key);
    const { className: link, ...abrir } = propsRelatorio(label);
    return (
      <div key={`${key}-${label}`} className={`${classe} ${extra || ""} ${link || ""}`} data-tone={tom} {...abrir}>
        <h4>{label}</h4>
        <span>{fmt(valor)}</span>
      </div>
    );
  };
  const rodando = snapshot?.running;
  const vendas = snapshot?.salesRunning;
  return (
    <div className="noc-resumo" aria-label="Painel NOC, visão resumida">
      <header className="noc-resumo-topo">
        <h2><Radar size={30} aria-hidden="true" /> Painel NOC</h2>
        <img src={logo} alt="AcessaNet" />
      </header>
      <p className="noc-resumo-status" role="status">
        <span data-tone={rede.state}>{EMOJI[rede.state] || "⚪"} {rede.label}</span>
        {" | "}
        {connected ? "🟢 Servidor conectado" : "🔴 Servidor desconectado"}
        {" | "}
        Última atualização: {horario(snapshot?.updated)}
        {snapshot ? ` | ${fmt(snapshot.total)} ocorrências abertas` : ""}
      </p>
      {!connected ? (
        <p className="noc-resumo-aviso" role="alert">
          {snapshot ? "Sem conexão com o servidor: os números são da última atualização recebida e podem estar desatualizados." : "Ainda sem dados do servidor."}
          {" "}{status}{detail ? ` (${detail})` : ""}.{" "}
          <button type="button" onClick={reconectarDashboard}>Tentar novamente</button>
        </p>
      ) : null}
      <div className="noc-metrics">
        {clientes.map(([label, valor]) => (
          <div className="card-2" key={label}>
            <h3>{label}</h3>
            <span>{fmt(valor)}</span>
          </div>
        ))}
      </div>
      <p className="noc-resumo-status" role="status">
        {customersUpdated
          ? `Base de clientes: última leitura às ${horario(customersUpdated)}. Atualização automática a cada 3 minutos.`
          : "Aguardando a base de clientes. O servidor envia os dados a cada 3 minutos."}
      </p>
      <section className="noc-section" aria-label="Chamados NOC">
        <h3><Headset size={18} aria-hidden="true" /> Chamados NOC</h3>
        <div className="noc-chamados">{CHAMADOS_1.map(([k, l, c]) => cartao(k, l, c))}</div>
        <div className="noc-chamados">
          {CHAMADOS_2_ANTES.map(([k, l]) => cartao(k, l))}
          <button
            type="button"
            className={`chamado-card em-andamento-card ${rodando && rodando.total > 0 ? "ativo" : ""} ${rodando?.stale ? "desatualizado" : ""}`}
            aria-label="Abrir chamados em andamento"
            disabled={!rodando}
            onClick={onOpenRunning}
          >
            <h4><HardHat size={14} aria-hidden="true" /> Em Andamento</h4>
            <span>{fmt(rodando?.total)}</span>
            <small className="em-andamento-sgp">SGP</small>
          </button>
          {CHAMADOS_2_DEPOIS.map(([k, l]) => cartao(k, l))}
        </div>
        <h3><Headset size={18} aria-hidden="true" /> Massivos</h3>
        <div className="noc-chamados">{MASSIVOS.map(([k, l]) => cartao(k, l, "", "chamado-card-massivo"))}</div>
      </section>
      <section className="noc-section" aria-label="Comercial e Financeiro">
        <h3><ShoppingCart size={18} aria-hidden="true" /> Comercial & Financeiro</h3>
        <div className="noc-chamados noc-comercial">
          <div
            {...propsRelatorio("Em andamento", "sgp-em-instalacao")}
            className={`chamado-card vendas-em-andamento-card ${vendas != null && vendas > 10 ? "alerta" : ""} ${window.desktop ? "sgp-link" : ""}`}
          >
            <h4><HardHat size={14} aria-hidden="true" /> Em andamento</h4>
            <span>{fmt(vendas)}</span>
            <small className="em-andamento-sgp" title="ATIVAÇÃO DE CONTRATO - COMUM">SGP</small>
          </div>
          {COMERCIAL.map(([k, l]) => cartao(k, l))}
        </div>
      </section>
      <section className="noc-section" aria-label="Almoxarifado">
        <h3><Warehouse size={18} aria-hidden="true" /> Almoxarifado</h3>
        <div className="noc-almox">
          {cartao("ALMOXARIFADO", "Almoxarifado", "almox", "info-card")}
          {["Fornecedores", "Itens em Estoque", "Equipamentos Críticos"].map((l) => (
            <div className="info-card almox sem-dados" key={l} title="Este indicador ainda não tem fonte de dados no servidor">
              <h4>{l}</h4>
              <span>sem integração</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
