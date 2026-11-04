import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import L from "leaflet";
import { Navigation, Pause, Play, RefreshCw, Truck } from "lucide-react";
import { clients, errorMessage } from "../../services/api";
import { useServers } from "../../stores/workspace";
import { Button } from "../../components/ui/button";
import { Badge, EmptyState, type Tone } from "../../components/ui/primitives";
import { LeafletMap, escapeHtml, pin } from "./LeafletMap";

type Veiculo = {
  placa?: string;
  nome?: string;
  velocidade?: number;
  ignicao?: boolean;
  ultimaPosicao?: string;
};
type Tecnico = {
  id: string;
  nome: string;
  regiao?: string;
  status?: string;
  latitude?: number | null;
  longitude?: number | null;
  fonteLocalizacaoLabel?: string;
  ultimaAtualizacaoLocalizacao?: string | null;
  statusPosicaoGps?: string;
  veiculo?: Veiculo | null;
  chamadosAtribuidos?: number;
  chamadosPendentes?: number;
  distanciaEstimadaKm?: number;
  tempoEstimadoMin?: number;
  cor?: string;
  alertaChamadosSimultaneos?: boolean;
};
type ChamadoRota = {
  id: string;
  cliente?: string;
  motivo?: string;
  enderecoCompleto?: string;
  bairro?: string;
  status?: string;
  horario?: string;
  latitude?: number | null;
  longitude?: number | null;
  tecnicoAtualNome?: string;
  corTecnico?: string;
};
type Rota = {
  id: string;
  tecnico_id: string;
  cor?: string;
  itens: { latitude: number; longitude: number; ordem: number }[];
};
type PontoFixo = {
  id: number;
  nome: string;
  icone?: string;
  cor?: string;
  latitude: number;
  longitude: number;
  ativo?: boolean;
};
type Coordenador = {
  tecnicos: Tecnico[];
  chamados: ChamadoRota[];
  rotas: Rota[];
  pontosFixos: PontoFixo[];
  resumo?: Record<string, number>;
  gpsTecnicosResumo?: Record<string, number>;
  opcoes?: { regioes?: string[]; tecnicos?: string[]; status?: string[]; motivos?: string[] };
  chamadosSemLocalizacao?: ChamadoRota[];
  chamadosLocalizacaoSuspeita?: ChamadoRota[];
  tecnicosSemLocalizacao?: Tecnico[];
  tecnicosSemUsuarioSgp?: Tecnico[];
  sugestoes?: { id?: string; chamadoId?: string; cliente?: string; tecnicoSugeridoNome?: string; motivo?: string }[];
  chamadosSimultaneos?: { totalTecnicos?: number; tecnicos?: { tecnicoNome?: string; nome?: string; totalChamados?: number }[] };
};
type TempoReal = {
  sincronizadoEm?: string;
  resumo?: { gpsTempoReal?: number; gpsAtual?: number };
  realtimeStatus?: string;
  tecnicos: Tecnico[];
  veiculosSemVinculo?: (Veiculo & { latitude?: number; longitude?: number; placa?: string; nomeVeiculo?: string })[];
};

const GPS: Record<string, [string, Tone]> = {
  tempo_real: ["Tempo real", "live"],
  atual: ["Atual", "ok"],
  antiga: ["Antiga", "warn"],
  desatualizado: ["Desatualizada", "crit"],
  desatualizada: ["Desatualizada", "crit"],
};
const STATUS_COR: Record<string, string> = {
  Aberta: "#2f6bff",
  "Em execução": "#f5c518",
  Encerrada: "#17b26a",
};
const plain = (v?: string) => (v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");
const valid = (lat?: number | null, lng?: number | null) =>
  typeof lat === "number" && typeof lng === "number" && !!lat && !!lng;
const quando = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "—";

export default function CoordenadorRota({ date, active }: { date: string; active: boolean }) {
  const configured = !!useServers((s) => s.config.agenda);
  const [tempoReal, setTempoReal] = useState(true);
  const [regiao, setRegiao] = useState("");
  const [tecnico, setTecnico] = useState("");
  const [status, setStatus] = useState("");
  const [motivo, setMotivo] = useState("");
  const [busca, setBusca] = useState("");
  const [camadas, setCamadas] = useState({
    tecnicos: true,
    chamados: true,
    rotas: true,
    pontos: true,
    veiculos: false,
    satelite: false,
  });
  const [foco, setFoco] = useState<string | null>(null);
  const base = useQuery({
    queryKey: ["agenda", "coordenador-rota", date, regiao, tecnico, status, motivo],
    enabled: configured && active,
    refetchInterval: tempoReal ? 60000 : false,
    queryFn: async () =>
      (
        await clients.agenda.get("/agenda-tecnicos/coordenador-rota", {
          // Mesmos filtros do app antigo: o servidor recorta chamados, resumo e rotas.
          params: { data: date, regiao, tecnicoId: tecnico, status, motivo },
          timeout: 90000,
        })
      ).data as Coordenador,
  });
  const posicoes = useQuery({
    queryKey: ["agenda", "posicoes-tempo-real"],
    enabled: configured && active && tempoReal,
    refetchInterval: 15000,
    queryFn: async () =>
      (await clients.agenda.get("/agenda-tecnicos/coordenador-rota/posicoes-tempo-real"))
        .data as TempoReal,
  });
  // Posição mais recente do RastreaMe por cima da foto da rota.
  const tecnicos = useMemo(() => {
    const vivos = new Map((posicoes.data?.tecnicos || []).map((t) => [t.id, t]));
    return (base.data?.tecnicos || [])
      .map((t) => {
        const v = vivos.get(t.id);
        return v && valid(v.latitude, v.longitude)
          ? {
              ...t,
              latitude: v.latitude,
              longitude: v.longitude,
              statusPosicaoGps: v.statusPosicaoGps || t.statusPosicaoGps,
              ultimaAtualizacaoLocalizacao: v.ultimaAtualizacaoLocalizacao || t.ultimaAtualizacaoLocalizacao,
              veiculo: v.veiculo || t.veiculo,
            }
          : t;
      })
      .filter((t) => (!regiao || t.regiao === regiao) && (!tecnico || t.id === tecnico || t.nome === tecnico));
  }, [base.data, posicoes.data, regiao, tecnico]);
  const termo = plain(busca.trim());
  const listados = termo
    ? tecnicos.filter((t) =>
        plain([t.nome, t.regiao, t.status, (GPS[t.statusPosicaoGps || ""] || ["Sem GPS"])[0], t.veiculo?.placa].filter(Boolean).join(" ")).includes(termo))
    : tecnicos;
  const ids = new Set(tecnicos.map((t) => t.id));
  const chamados = base.data?.chamados || [];
  const filtrosAtivos = [regiao, tecnico, status, motivo].filter(Boolean).length;
  const rotas = (base.data?.rotas || []).filter((r) => ids.has(r.tecnico_id));
  const toggle = (k: keyof typeof camadas) => setCamadas((c) => ({ ...c, [k]: !c[k] }));

  if (!configured)
    return (
      <div className="panel">
        <EmptyState icon={Navigation} title="Conecte sua agenda">
          Configure a URL do serviço em Configurações.
        </EmptyState>
      </div>
    );

  const nomeChamado = (c: ChamadoRota) => `${c.cliente || "Chamado"}${c.tecnicoAtualNome ? ` · ${c.tecnicoAtualNome}` : ""}`;
  const alertas = [
    { titulo: "Chamados sem localização", itens: (base.data?.chamadosSemLocalizacao || []).map(nomeChamado) },
    { titulo: "Localização suspeita", itens: (base.data?.chamadosLocalizacaoSuspeita || []).map(nomeChamado) },
    { titulo: "Técnicos sem localização", itens: (base.data?.tecnicosSemLocalizacao || []).map((t) => t.nome) },
    { titulo: "Técnicos sem usuário no SGP", itens: (base.data?.tecnicosSemUsuarioSgp || []).map((t) => t.nome) },
    {
      titulo: "Chamados simultâneos",
      itens: (base.data?.chamadosSimultaneos?.tecnicos || []).map((t) => `${t.tecnicoNome || t.nome || "Técnico"}${t.totalChamados ? ` · ${t.totalChamados} chamados` : ""}`),
    },
    {
      titulo: "Sugestões de rota",
      itens: (base.data?.sugestoes || []).map((g) => `${g.cliente || g.chamadoId || "Chamado"}${g.tecnicoSugeridoNome ? ` → ${g.tecnicoSugeridoNome}` : ""}`),
    },
  ].filter((a) => a.itens.length);
  const resumo = base.data?.resumo || {};
  const gps = base.data?.gpsTecnicosResumo || {};
  const vivo = posicoes.data?.resumo;
  const gpsVivo = vivo ? (vivo.gpsTempoReal ?? 0) + (vivo.gpsAtual ?? 0) : gps.atual;
  return (
    <div className="agenda-mapa">
      <div className="agenda-map-head panel">
        <div>
          <h2>Coordenador de Rotas</h2>
          <p>
            {posicoes.data?.sincronizadoEm
              ? `Posições do RastreaMe às ${quando(posicoes.data.sincronizadoEm)}`
              : "Técnicos, veículos e rotas do dia."}
          </p>
        </div>
        <div className="agenda-map-head-side">
          <Button
            size="sm"
            variant={tempoReal ? "soft" : "outline"}
            aria-pressed={tempoReal}
            onClick={() => setTempoReal((v) => !v)}
          >
            {tempoReal ? <Pause size={14} /> : <Play size={14} />}
            Tempo real: {tempoReal ? "ligado" : "pausado"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={base.isFetching}
            onClick={() => {
              void base.refetch();
              void posicoes.refetch();
            }}
          >
            <RefreshCw size={14} className={base.isFetching ? "animate-spin" : ""} />
            Atualizar
          </Button>
        </div>
      </div>
      <div className="agenda-kpis">
        {(
          [
            ["Técnicos", resumo.tecnicos, "info"],
            ["Chamados do dia", resumo.chamados, "info"],
            ["GPS em tempo real ou atual", gpsVivo, "live"],
            ["GPS antigo ou desatualizado", (gps.antigo ?? 0) + (gps.desatualizado ?? 0), "warn"],
            ["Sem veículo vinculado", gps.semVeiculoVinculado, "neutral"],
            ["Distância planejada", resumo.distanciaTotalKm != null ? `${resumo.distanciaTotalKm} km` : null, "neutral"],
          ] as const
        ).map(([label, value, tone]) => (
          <div key={label} className="agenda-kpi" data-tone={tone}>
            <span>{label}</span>
            <strong>{base.data ? (value ?? "—") : "—"}</strong>
          </div>
        ))}
      </div>
      {base.isError ? (
        <p className="inline-error" role="alert">
          {errorMessage(base.error)}
        </p>
      ) : null}
      <div className="agenda-map-layout is-left">
        <aside className="agenda-map-list panel panel--flush" aria-label="Técnicos no mapa">
          <div className="agenda-route-filters">
            <label className="field">
              <span>Região</span>
              <select value={regiao} onChange={(e) => setRegiao(e.target.value)}>
                <option value="">Todas</option>
                {(base.data?.opcoes?.regioes || []).map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Técnico</span>
              <select value={tecnico} onChange={(e) => setTecnico(e.target.value)}>
                <option value="">Todos</option>
                {(base.data?.opcoes?.tecnicos || []).map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Status</span>
              <select aria-label="Status do chamado" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Todos</option>
                {(base.data?.opcoes?.status || []).map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Motivo</span>
              <select aria-label="Motivo do chamado" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
                <option value="">Todos</option>
                {(base.data?.opcoes?.motivos || []).map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            {filtrosAtivos ? (
              <Button size="sm" variant="ghost" onClick={() => { setRegiao(""); setTecnico(""); setStatus(""); setMotivo(""); }}>
                Limpar filtros ({filtrosAtivos})
              </Button>
            ) : null}
          </div>
          <label className="field agenda-route-search">
            <span>Pesquisar técnico</span>
            <input
              type="search"
              aria-label="Pesquisar técnico"
              placeholder="Nome, região, status ou GPS"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </label>
          <header>
            <strong>Técnicos</strong>
            <span>{listados.length === tecnicos.length ? tecnicos.length : `${listados.length} de ${tecnicos.length}`}</span>
          </header>
          {base.isPending ? (
            <p className="agenda-map-empty">Carregando técnicos e rotas…</p>
          ) : (
            <ul>
              {listados.map((t) => {
                const [gpsLabel, gpsTone] = GPS[t.statusPosicaoGps || ""] || ["Sem GPS", "neutral"];
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      className={foco === t.id ? "is-active" : ""}
                      onClick={() => setFoco(t.id)}
                    >
                      <span className="agenda-tech-dot" style={{ "--pin": t.cor || "#8a96ad" } as React.CSSProperties}>
                        {t.nome.slice(0, 2)}
                      </span>
                      <span className="agenda-map-item">
                        <strong>
                          {t.nome}
                          {t.regiao ? <em> · {t.regiao}</em> : null}
                        </strong>
                        <small>
                          {t.chamadosPendentes ?? 0} pendente(s)
                          {t.distanciaEstimadaKm ? ` · ${t.distanciaEstimadaKm} km` : ""}
                          {t.veiculo?.placa ? ` · ${t.veiculo.placa}` : ""}
                        </small>
                      </span>
                      <Badge tone={gpsTone}>{gpsLabel}</Badge>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <details className="agenda-route-alerts">
            <summary>
              Alertas e pendências
              {alertas.length ? <Badge tone="warn">{alertas.reduce((n, a) => n + a.itens.length, 0)}</Badge> : null}
            </summary>
            {alertas.length ? (
              alertas.map((a) => (
                <div key={a.titulo}>
                  <strong>{a.titulo}</strong>
                  <ul>
                    {a.itens.slice(0, 8).map((i, n) => <li key={`${a.titulo}-${n}`}>{i}</li>)}
                    {a.itens.length > 8 ? <li>+ {a.itens.length - 8} outros</li> : null}
                  </ul>
                </div>
              ))
            ) : (
              <p className="agenda-map-empty">Nenhum alerta para os filtros atuais.</p>
            )}
          </details>
        </aside>
        <div className="agenda-map-frame">
          <div className="agenda-map-toolbar">
            {(
              [
                ["tecnicos", "Técnicos"],
                ["chamados", "Chamados"],
                ["rotas", "Rotas"],
                ["pontos", "Pontos fixos"],
                ["veiculos", "Veículos sem vínculo"],
                ["satelite", "Satélite"],
              ] as const
            ).map(([k, l]) => (
              <button key={k} type="button" aria-pressed={camadas[k]} onClick={() => toggle(k)}>
                {k === "veiculos" ? <Truck size={13} /> : null}
                {l}
              </button>
            ))}
          </div>
          <LeafletMap
            satelite={camadas.satelite}
            fitKey={`${date}|${regiao}|${tecnico}|${status}|${motivo}|${base.data ? 1 : 0}`}
            deps={[tecnicos, chamados, rotas, camadas, foco, base.data?.pontosFixos, posicoes.data?.veiculosSemVinculo]}
            draw={(layer, map) => {
              const bounds = L.latLngBounds([]);
              if (camadas.pontos)
                for (const p of base.data?.pontosFixos || []) {
                  if (p.ativo === false || !valid(p.latitude, p.longitude)) continue;
                  L.marker([p.latitude, p.longitude], {
                    icon: L.divIcon({
                      className: "agenda-pin",
                      html: `<span class="agenda-pin-fixed" style="--pin:${escapeHtml(p.cor || "#8a96ad")}">${escapeHtml(p.icone || "📍")}</span>`,
                      iconSize: [24, 24],
                      iconAnchor: [12, 12],
                    }),
                  })
                    .bindTooltip(escapeHtml(p.nome))
                    .addTo(layer);
                }
              if (camadas.rotas)
                for (const r of rotas) {
                  const t = tecnicos.find((x) => x.id === r.tecnico_id);
                  const pontos: L.LatLngExpression[] = [
                    ...(t && valid(t.latitude, t.longitude) ? [[t.latitude!, t.longitude!] as L.LatLngTuple] : []),
                    ...[...r.itens]
                      .sort((a, b) => a.ordem - b.ordem)
                      .filter((i) => valid(i.latitude, i.longitude))
                      .map((i) => [i.latitude, i.longitude] as L.LatLngTuple),
                  ];
                  if (pontos.length > 1)
                    L.polyline(pontos, {
                      color: r.cor || t?.cor || "#2f6bff",
                      weight: foco && foco !== r.tecnico_id ? 2 : 4,
                      opacity: foco && foco !== r.tecnico_id ? 0.35 : 0.85,
                      dashArray: "6 6",
                    }).addTo(layer);
                }
              if (camadas.chamados)
                for (const c of chamados) {
                  if (!valid(c.latitude, c.longitude)) continue;
                  bounds.extend([c.latitude!, c.longitude!]);
                  L.marker([c.latitude!, c.longitude!], {
                    icon: pin(STATUS_COR[c.status || ""] || "#8a96ad", "", 14, "is-small"),
                  })
                    .bindPopup(
                      `<strong>${escapeHtml(c.cliente)}</strong><br>${escapeHtml(c.status)} · ${escapeHtml((c.horario || "").slice(0, 5))} · ${escapeHtml(c.tecnicoAtualNome)}<br>${escapeHtml(c.motivo)}<br>${escapeHtml(c.enderecoCompleto)}`,
                    )
                    .addTo(layer);
                }
              if (camadas.veiculos)
                for (const v of posicoes.data?.veiculosSemVinculo || []) {
                  if (!valid(v.latitude, v.longitude)) continue;
                  L.marker([v.latitude!, v.longitude!], { icon: pin("#64748b", "🚗", 24) })
                    .bindTooltip(escapeHtml(`${v.nomeVeiculo || v.nome || ""} ${v.placa || ""}`.trim()))
                    .addTo(layer);
                }
              if (camadas.tecnicos)
                for (const t of tecnicos) {
                  if (!valid(t.latitude, t.longitude)) continue;
                  const pos: L.LatLngTuple = [t.latitude!, t.longitude!];
                  bounds.extend(pos);
                  const [gpsLabel] = GPS[t.statusPosicaoGps || ""] || ["Sem GPS"];
                  const m = L.marker(pos, {
                    icon: pin(
                      t.cor || "#2f6bff",
                      t.nome.slice(0, 2),
                      foco === t.id ? 38 : 32,
                      t.statusPosicaoGps === "tempo_real" ? "is-live" : "",
                    ),
                    zIndexOffset: 500 + (foco === t.id ? 1000 : 0),
                  })
                    .bindPopup(
                      `<strong>${escapeHtml(t.nome)}</strong>${t.regiao ? ` · ${escapeHtml(t.regiao)}` : ""}<br>
                       GPS: ${escapeHtml(gpsLabel)} · ${escapeHtml(quando(t.ultimaAtualizacaoLocalizacao))}<br>
                       ${t.veiculo?.placa ? `Veículo ${escapeHtml(t.veiculo.nome || "")} · ${escapeHtml(t.veiculo.placa)} · ${t.veiculo.ignicao ? "ignição ligada" : "ignição desligada"} · ${t.veiculo.velocidade ?? 0} km/h<br>` : ""}
                       ${t.chamadosPendentes ?? 0} chamado(s) pendente(s)${t.tempoEstimadoMin ? ` · ${t.tempoEstimadoMin} min de rota` : ""}`,
                    )
                    .addTo(layer);
                  if (foco === t.id) {
                    m.openPopup();
                    map.panTo(pos);
                  }
                }
              return bounds;
            }}
          />
        </div>
      </div>
    </div>
  );
}
