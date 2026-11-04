import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import L from "leaflet";
import { Layers, MapPin, RefreshCw, Search, X } from "lucide-react";
import { clients, errorMessage } from "../../services/api";
import { useServers } from "../../stores/workspace";
import { Button } from "../../components/ui/button";
import { EmptyState, Segmented } from "../../components/ui/primitives";
import { LeafletMap, escapeHtml, pin } from "./LeafletMap";

type Chamado = {
  id: string;
  numero?: string;
  fila: string;
  status?: string;
  cliente?: string;
  contrato?: string;
  motivo?: string;
  dataAbertura?: string;
  dataAberturaDia?: string;
  minutosAberto?: number | null;
  tempoAbertoLabel?: string;
  prioridadeAntiga?: boolean;
  endereco: { bairro?: string; cidade?: string; enderecoCompleto?: string };
  latitude: number;
  longitude: number;
  tecnicoResponsavelNome?: string | null;
};
type Concentracao = {
  id: number;
  bairro: string;
  centro: { latitude: number; longitude: number };
  raioMetros: number;
  totalChamados: number;
};
type MapaDados = {
  atualizadoEm?: string;
  geradoEm?: string;
  chamados: Chamado[];
  concentracoes: Concentracao[];
  naoLocalizados: { id: string }[];
  opcoesFiltro?: { cidades: string[]; bairros: string[] };
};

// Cores por fila, como na legenda da agenda original.
export const FILA_COR: Record<string, string> = {
  ST: "#2f6bff",
  N1: "#a855f7",
  N2: "#f5a524",
};
const norm = (v = "") =>
  v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const hoje = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const TEMPOS = [
  [0, "Tempo em aberto (todos)"],
  [60, "Mais de 1 hora"],
  [240, "Mais de 4 horas"],
  [1440, "Mais de 1 dia"],
  [4320, "Mais de 3 dias"],
] as const;

export default function MapaChamados({ active }: { active: boolean }) {
  const configured = !!useServers((s) => s.config.agenda);
  const query = useQueryClient();
  const [fila, setFila] = useState<"todos" | "ST" | "N1" | "N2">("todos");
  const [cidade, setCidade] = useState("");
  const [bairro, setBairro] = useState("");
  const [tempo, setTempo] = useState(0);
  const [soHoje, setSoHoje] = useState(false);
  const [busca, setBusca] = useState("");
  const [satelite, setSatelite] = useState(false);
  const [areas, setAreas] = useState(true);
  const [foco, setFoco] = useState<string | null>(null);
  const dados = useQuery({
    queryKey: ["agenda", "mapa-chamados"],
    enabled: configured && active,
    refetchInterval: 60000,
    queryFn: async () =>
      (await clients.agenda.get("/agenda-tecnicos/mapa-chamados", { timeout: 90000 }))
        .data as MapaDados,
  });
  const atualizar = async () => {
    const data = (
      await clients.agenda.get("/agenda-tecnicos/mapa-chamados", {
        params: { force: 1 },
        timeout: 90000,
      })
    ).data;
    query.setQueryData(["agenda", "mapa-chamados"], data);
  };
  const todos = dados.data?.chamados || [];
  const visiveis = useMemo(() => {
    const b = norm(busca),
      c = norm(cidade),
      br = norm(bairro),
      dia = hoje();
    return todos
      .filter(
        (ch) =>
          (fila === "todos" || ch.fila === fila) &&
          (!c || norm(ch.endereco.cidade) === c) &&
          (!br || norm(ch.endereco.bairro) === br) &&
          (!soHoje || ch.dataAberturaDia === dia) &&
          (!tempo || (ch.minutosAberto ?? -1) >= tempo) &&
          (!b ||
            norm(
              [ch.cliente, ch.contrato, ch.numero, ch.endereco.enderecoCompleto, ch.endereco.bairro]
                .filter(Boolean)
                .join(" "),
            ).includes(b)),
      )
      .sort((a, b2) => (b2.minutosAberto ?? 0) - (a.minutosAberto ?? 0));
  }, [todos, fila, cidade, bairro, soHoje, tempo, busca]);
  const contagem = (f: string) => visiveis.filter((c) => c.fila === f).length;
  const maisAntigo = visiveis[0];
  const filtrosKey = [fila, cidade, bairro, soHoje, tempo, busca].join("|");

  if (!configured)
    return (
      <div className="panel">
        <EmptyState icon={MapPin} title="Conecte sua agenda">
          Configure a URL do serviço em Configurações.
        </EmptyState>
      </div>
    );

  return (
    <div className="agenda-mapa">
      <div className="agenda-map-head panel">
        <div>
          <h2>Mapa de Chamados</h2>
          <p>Visualização geográfica dos chamados de suporte técnico, N1 e N2.</p>
        </div>
        <div className="agenda-map-head-side">
          <span className="muted text-xs">
            {dados.isFetching
              ? "Carregando… a primeira consulta ao SGP pode levar até 1 minuto."
              : dados.data?.atualizadoEm
                ? `Atualizado às ${new Date(dados.data.atualizadoEm).toLocaleTimeString("pt-BR")}`
                : ""}
          </span>
          <span className="connection online">
            <i />
            Atualização automática
          </span>
          <Button size="sm" variant="outline" onClick={() => void atualizar()} disabled={dados.isFetching}>
            <RefreshCw size={14} className={dados.isFetching ? "animate-spin" : ""} />
            Atualizar
          </Button>
        </div>
      </div>
      <div className="agenda-kpis">
        {(
          [
            ["Chamados abertos", visiveis.length, "info"],
            ["Suporte técnico", contagem("ST"), "info"],
            ["N1", contagem("N1"), "violet"],
            ["N2", contagem("N2"), "warn"],
            ["Regiões com concentração", dados.data?.concentracoes.length ?? null, "crit"],
            ["Chamado mais antigo", maisAntigo?.tempoAbertoLabel ?? null, "neutral"],
          ] as const
        ).map(([label, value, tone]) => (
          <div key={label} className="agenda-kpi" data-tone={tone}>
            <span>{label}</span>
            <strong>{dados.data ? (value ?? "—") : "—"}</strong>
          </div>
        ))}
      </div>
      <div className="agenda-map-filters panel">
        <Segmented
          label="Fila"
          value={fila}
          options={[
            ["todos", "Todos"],
            ["ST", "Suporte Técnico"],
            ["N1", "N1"],
            ["N2", "N2"],
          ]}
          onChange={setFila}
        />
        <select aria-label="Cidade" value={cidade} onChange={(e) => setCidade(e.target.value)}>
          <option value="">Cidade (todas)</option>
          {(dados.data?.opcoesFiltro?.cidades || []).map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select aria-label="Bairro" value={bairro} onChange={(e) => setBairro(e.target.value)}>
          <option value="">Bairro (todos)</option>
          {(dados.data?.opcoesFiltro?.bairros || []).map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select aria-label="Tempo em aberto" value={tempo} onChange={(e) => setTempo(Number(e.target.value))}>
          {TEMPOS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <Button size="sm" variant={soHoje ? "soft" : "outline"} aria-pressed={soHoje} onClick={() => setSoHoje((v) => !v)}>
          Hoje
        </Button>
        <label className="search-box">
          <Search size={15} />
          <input
            aria-label="Buscar chamado no mapa"
            placeholder="Buscar cliente, contrato, endereço ou chamado"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          {busca ? (
            <button type="button" className="search-clear" aria-label="Limpar busca" onClick={() => setBusca("")}>
              <X size={14} />
            </button>
          ) : null}
        </label>
      </div>
      {dados.isError ? (
        <p className="inline-error" role="alert">
          {errorMessage(dados.error)} O mapa mostra a última resposta recebida.
        </p>
      ) : null}
      <div className="agenda-map-layout">
        <div className="agenda-map-frame">
          <div className="agenda-map-toolbar">
            <button type="button" aria-pressed={!satelite} onClick={() => setSatelite(false)}>
              Ruas
            </button>
            <button type="button" aria-pressed={satelite} onClick={() => setSatelite(true)}>
              Satélite
            </button>
            <button type="button" aria-pressed={areas} onClick={() => setAreas((v) => !v)}>
              <Layers size={13} />
              Concentrações
            </button>
          </div>
          <LeafletMap
            satelite={satelite}
            fitKey={filtrosKey + (dados.data ? "1" : "0")}
            deps={[visiveis, areas, foco, dados.data?.concentracoes]}
            draw={(layer, map) => {
              const bounds = L.latLngBounds([]);
              if (areas)
                for (const c of dados.data?.concentracoes || [])
                  L.circle([c.centro.latitude, c.centro.longitude], {
                    radius: c.raioMetros,
                    color: "#e5484d",
                    weight: 1.5,
                    fillOpacity: 0.12,
                  })
                    .bindTooltip(`${c.bairro}: ${c.totalChamados} chamados`)
                    .addTo(layer);
              for (const ch of visiveis) {
                const pos: L.LatLngExpression = [ch.latitude, ch.longitude];
                bounds.extend(pos);
                const m = L.marker(pos, {
                  icon: pin(
                    FILA_COR[ch.fila] || "#8a96ad",
                    ch.fila,
                    foco === ch.id ? 34 : 26,
                    ch.prioridadeAntiga ? "is-old" : "",
                  ),
                  zIndexOffset: foco === ch.id ? 1000 : 0,
                })
                  .bindPopup(
                    `<strong>${escapeHtml(ch.cliente)}</strong><br>
                     Chamado ${escapeHtml(ch.numero)} · ${escapeHtml(ch.fila)} · contrato ${escapeHtml(ch.contrato)}<br>
                     ${escapeHtml(ch.endereco.enderecoCompleto)}<br>
                     <em>${escapeHtml(ch.motivo)}</em><br>
                     Aberto há ${escapeHtml(ch.tempoAbertoLabel)}${ch.tecnicoResponsavelNome ? ` · ${escapeHtml(ch.tecnicoResponsavelNome)}` : ""}`,
                  )
                  .addTo(layer);
                if (foco === ch.id) {
                  m.openPopup();
                  map.panTo(pos);
                }
              }
              return bounds;
            }}
          />
        </div>
        <aside className="agenda-map-list panel panel--flush" aria-label="Chamados no mapa">
          <header>
            <strong>Chamados no mapa</strong>
            <span>{visiveis.length} chamados</span>
          </header>
          {dados.isPending ? (
            <p className="agenda-map-empty">Carregando chamados… a primeira consulta ao SGP pode levar até 1 minuto.</p>
          ) : visiveis.length ? (
            <ul>
              {visiveis.map((ch) => (
                <li key={ch.id}>
                  <button
                    type="button"
                    className={foco === ch.id ? "is-active" : ""}
                    onClick={() => setFoco(ch.id)}
                  >
                    <span className="agenda-fila" style={{ "--pin": FILA_COR[ch.fila] || "#8a96ad" } as React.CSSProperties}>
                      {ch.fila}
                    </span>
                    <span className="agenda-map-item">
                      <strong>{ch.cliente}</strong>
                      <small>
                        {ch.endereco.bairro} · {ch.endereco.cidade}
                      </small>
                    </span>
                    <time className={ch.prioridadeAntiga ? "is-old" : ""}>{ch.tempoAbertoLabel}</time>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="agenda-map-empty">Nenhum chamado corresponde aos filtros.</p>
          )}
          {dados.data?.naoLocalizados.length ? (
            <footer>{dados.data.naoLocalizados.length} chamado(s) sem localização não aparecem no mapa.</footer>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
