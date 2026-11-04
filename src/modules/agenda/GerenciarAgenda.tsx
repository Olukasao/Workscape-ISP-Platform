import { useEffect, useMemo, useState } from "react";
import { avisarMudancaAgenda } from "../../services/janelaDestacada";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { clients, errorMessage } from "../../services/api";
import { Button } from "../../components/ui/button";
import { Badge, EmptyState, Segmented, Skeleton } from "../../components/ui/primitives";

export interface Tecnico {
  id: string;
  nome: string;
}
type Aba = "ausencias" | "equipes" | "bloqueios";
interface Ausencia {
  id: number;
  technician_id: string;
  absence_date?: string;
  absence_reason: string;
  absence_note?: string | null;
  completed_at?: string | null;
}
interface CorEquipe {
  id: number;
  technician_id: string;
  team_color: string;
}
interface Bloqueio {
  id: number;
  tecnicoId: string;
  tipo: string;
  descricao?: string | null;
  horaInicio: string;
  horaFim: string;
  finalizado?: boolean;
}

const MOTIVOS: [string, string][] = [
  ["folga", "Folga"],
  ["ferias", "Férias"],
  ["medico", "Médico"],
  ["atestado", "Atestado"],
  ["mecanico", "Mecânico"],
  ["duplado", "Duplado"],
  ["outro", "Outro"],
];
const TIPOS_BLOQUEIO: [string, string][] = [
  ["almoco", "Almoço"],
  ["compromisso", "Compromisso"],
  ["reuniao", "Reunião"],
  ["treinamento", "Treinamento"],
  ["indisponivel", "Indisponível"],
  ["outro", "Outro (chamado externo)"],
];
const CORES: [string, string][] = [
  ["azul", "#2f6bff"],
  ["verde", "#17b26a"],
  ["roxo", "#8b5cf6"],
  ["laranja", "#f97316"],
  ["vermelho", "#e5484d"],
  ["cinza", "#64748b"],
];
const rotulo = (lista: [string, string][], chave: string) => lista.find(([k]) => k === chave)?.[1] || chave;

/** Botão que pede uma segunda confirmação antes de uma ação destrutiva. */
function ConfirmarRemocao({ onConfirm, disabled }: { onConfirm: () => void; disabled?: boolean }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);
  return armed ? (
    <Button size="sm" variant="outline" className="manage-danger" disabled={disabled} onClick={() => { setArmed(false); onConfirm(); }}>
      Confirmar remoção
    </Button>
  ) : (
    <Button size="icon" variant="ghost" aria-label="Remover" title="Remover" disabled={disabled} onClick={() => setArmed(true)}>
      <Trash2 size={15} />
    </Button>
  );
}

export default function GerenciarAgenda({
  service,
  date,
  installation,
  technicians,
  onClose,
}: {
  service: "agenda";
  date: string;
  installation: boolean;
  technicians: Tecnico[];
  onClose: () => void;
}) {
  const api = clients[service];
  const queryClient = useQueryClient();
  const [aba, setAba] = useState<Aba>("ausencias");
  const [error, setError] = useState("");
  const horaFimMax = installation ? "21:00" : "23:59";
  const prefix = installation ? "/agenda-instalacao" : "/agenda-tecnicos";
  const nomeDe = (id: string) => technicians.find((t) => t.id === id)?.nome || id;
  useEffect(() => {
    const handle = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [onClose]);
  const refreshAgenda = () => {
    void queryClient.invalidateQueries({ queryKey: [service] });
    void queryClient.invalidateQueries({ queryKey: ["agenda"] });
    avisarMudancaAgenda();
  };
  const run = useMutation({
    mutationFn: async (action: () => Promise<unknown>) => action(),
    onMutate: () => setError(""),
    onSuccess: refreshAgenda,
    onError: (e) => setError(errorMessage(e)),
  });
  const mutate = (action: () => Promise<unknown>, done?: () => void) =>
    run.mutate(action, { onSuccess: done });

  // ---- Ausências
  const ausenciasPath = installation ? "/agenda-instalacao/ausencias" : "/technician-absences";
  const ausencias = useQuery({
    queryKey: [service, "gerenciar", "ausencias", installation, date],
    queryFn: async () => {
      const { data } = await api.get(ausenciasPath, { params: { date } });
      return (data.absences || data.ausencias || []) as Ausencia[];
    },
  });
  const [ausId, setAusId] = useState<number | null>(null);
  const [ausTec, setAusTec] = useState("");
  const [ausMotivo, setAusMotivo] = useState("folga");
  const [ausNota, setAusNota] = useState("");
  const motivos = MOTIVOS.filter(([k]) => !installation || k !== "duplado");
  const limparAusencia = () => { setAusId(null); setAusTec(""); setAusMotivo("folga"); setAusNota(""); };
  const salvarAusencia = () => {
    const body = { technician_id: ausTec, absence_date: date, absence_reason: ausMotivo, absence_note: ausNota.trim() };
    mutate(() => (ausId ? api.put(`${ausenciasPath}/${ausId}`, body) : api.post(ausenciasPath, body)), limparAusencia);
  };

  // ---- Equipes (somente manutenção)
  const equipes = useQuery({
    queryKey: [service, "gerenciar", "equipes", date],
    enabled: !installation,
    queryFn: async () => {
      const { data } = await api.get("/technician-team-colors", { params: { date } });
      return (data.teamColors || data.coresEquipe || []) as CorEquipe[];
    },
  });
  const corDe = (tec: string) => equipes.data?.find((c) => c.technician_id === tec);
  const definirCor = (tec: string, cor: string) => {
    const atual = corDe(tec);
    mutate(() => atual?.team_color === cor
      ? api.delete(`/technician-team-colors/${atual.id}`)
      : api.post("/technician-team-colors", { technician_id: tec, team_date: date, team_color: cor }));
  };

  // ---- Bloqueios de horário (almoço, reunião, chamado externo…)
  const bloqueios = useQuery({
    queryKey: [service, "gerenciar", "bloqueios", installation, date],
    queryFn: async () => {
      const { data } = await api.get(`${prefix}/almocos`, { params: { data: date } });
      return (data.almocos || []) as Bloqueio[];
    },
  });
  const [blqId, setBlqId] = useState<number | null>(null);
  const [blqTec, setBlqTec] = useState("");
  const [blqTipo, setBlqTipo] = useState("almoco");
  const [blqIni, setBlqIni] = useState("12:00");
  const [blqFim, setBlqFim] = useState("13:00");
  const [blqDesc, setBlqDesc] = useState("");
  const limparBloqueio = () => { setBlqId(null); setBlqTec(""); setBlqTipo("almoco"); setBlqIni("12:00"); setBlqFim("13:00"); setBlqDesc(""); };
  const salvarBloqueio = () => {
    const body = {
      tecnicoId: blqTec, data: date, tipo: blqTipo, horaInicio: blqIni, horaFim: blqFim,
      ...(blqTipo === "almoco" ? {} : { descricao: blqDesc.trim() }),
    };
    mutate(() => (blqId ? api.put(`${prefix}/almocos/${blqId}`, body) : api.post(`${prefix}/almocos`, body)), limparBloqueio);
  };

  const ordenados = useMemo(() => [...technicians].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")), [technicians]);
  const dia = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
    .format(new Date(`${date}T12:00:00Z`));
  const abas: [Aba, string][] = installation
    ? [["ausencias", "Ausências"], ["bloqueios", "Bloqueios"]]
    : [["ausencias", "Ausências"], ["equipes", "Equipes"], ["bloqueios", "Bloqueios"]];
  const tecnicoSelect = (value: string, onChange: (v: string) => void) => (
    <select aria-label="Técnico" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Selecione o técnico</option>
      {ordenados.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
    </select>
  );

  return (
    <div className="modal-backdrop is-drawer" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="detail-panel manage-panel" role="dialog" aria-modal="true" aria-label="Gerenciar agenda">
        <div className="detail-head">
          <span className="detail-kicker">{installation ? "Agenda Instalação" : "Agenda Manutenção"}</span>
          <Button variant="ghost" size="icon" aria-label="Fechar" onClick={onClose}><X size={18} /></Button>
        </div>
        <h2>Gerenciar agenda</h2>
        <p className="manage-day">{dia}</p>
        <Segmented label="Seção" value={aba} options={abas} onChange={(v) => { setAba(v as Aba); setError(""); }} />
        {error ? <p className="inline-error" role="alert">{error}</p> : null}

        {aba === "ausencias" && (
          <div className="manage-section">
            <div className="manage-form">
              <label className="field"><span>Técnico</span>{tecnicoSelect(ausTec, setAusTec)}</label>
              <label className="field"><span>Motivo</span>
                <select aria-label="Motivo" value={ausMotivo} onChange={(e) => setAusMotivo(e.target.value)}>
                  {motivos.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </label>
              <label className="field"><span>Observação</span>
                <input aria-label="Observação" maxLength={80} value={ausNota} onChange={(e) => setAusNota(e.target.value)} placeholder="Opcional (até 80 caracteres)" />
              </label>
              <div className="manage-actions">
                <Button disabled={!ausTec || run.isPending} onClick={salvarAusencia}>
                  {ausId ? <Check size={15} /> : <Plus size={15} />} {ausId ? "Salvar alteração" : "Registrar ausência"}
                </Button>
                {ausId ? <Button variant="ghost" onClick={limparAusencia}>Cancelar edição</Button> : null}
              </div>
            </div>
            <h3>Ausências do dia</h3>
            {ausencias.isLoading ? <Skeleton /> : !ausencias.data?.length ? <EmptyState compact title="Nenhuma ausência neste dia" /> : (
              <ul className="manage-list">
                {ausencias.data.map((a) => (
                  <li key={a.id}>
                    <div>
                      <strong>{nomeDe(a.technician_id)}</strong>
                      <span>{rotulo(MOTIVOS, a.absence_reason)}{a.absence_note ? ` · ${a.absence_note}` : ""}</span>
                      {a.completed_at ? <Badge tone="ok">Concluído</Badge> : null}
                    </div>
                    <div className="manage-row-actions">
                      <Button size="icon" variant="ghost" aria-label="Editar" title="Editar" onClick={() => { setAusId(a.id); setAusTec(a.technician_id); setAusMotivo(a.absence_reason); setAusNota(a.absence_note || ""); }}>
                        <Pencil size={15} />
                      </Button>
                      {!installation && a.absence_reason === "outro" && !a.completed_at ? (
                        <Button size="sm" variant="outline" disabled={run.isPending} onClick={() => mutate(() => api.post(`${ausenciasPath}/${a.id}/complete`))}>Concluir chamado</Button>
                      ) : null}
                      <ConfirmarRemocao disabled={run.isPending} onConfirm={() => mutate(() => api.delete(`${ausenciasPath}/${a.id}`), () => { if (ausId === a.id) limparAusencia(); })} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {aba === "equipes" && !installation && (
          <div className="manage-section">
            <p className="manage-help">Escolha a cor da equipe de cada técnico neste dia. Clique na cor atual para remover.</p>
            {equipes.isLoading ? <Skeleton /> : (
              <ul className="manage-list">
                {ordenados.map((t) => (
                  <li key={t.id}>
                    <div><strong>{t.nome}</strong></div>
                    <div className="manage-swatches" role="group" aria-label={`Cor da equipe de ${t.nome}`}>
                      {CORES.map(([k, hex]) => (
                        <button
                          key={k}
                          type="button"
                          className="manage-swatch"
                          style={{ background: hex }}
                          aria-label={k}
                          title={k}
                          aria-pressed={corDe(t.id)?.team_color === k}
                          disabled={run.isPending}
                          onClick={() => definirCor(t.id, k)}
                        />
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {aba === "bloqueios" && (
          <div className="manage-section">
            <div className="manage-form">
              <label className="field"><span>Técnico</span>{tecnicoSelect(blqTec, setBlqTec)}</label>
              <label className="field"><span>Tipo</span>
                <select aria-label="Tipo" value={blqTipo} onChange={(e) => { setBlqTipo(e.target.value); if (e.target.value === "almoco") setBlqDesc(""); }}>
                  {TIPOS_BLOQUEIO.filter(([k]) => !installation || k !== "outro").map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </label>
              <div className="manage-times">
                <label className="field"><span>Início</span>
                  <input aria-label="Início" type="time" min="08:00" max={horaFimMax} value={blqIni} onChange={(e) => setBlqIni(e.target.value)} />
                </label>
                <label className="field"><span>Fim</span>
                  <input aria-label="Fim" type="time" min="08:00" max={horaFimMax} value={blqFim} onChange={(e) => setBlqFim(e.target.value)} />
                </label>
              </div>
              {blqTipo !== "almoco" ? (
                <label className="field"><span>Descrição</span>
                  <input aria-label="Descrição" maxLength={255} value={blqDesc} onChange={(e) => setBlqDesc(e.target.value)} placeholder="Ex.: reunião de equipe" />
                </label>
              ) : null}
              <div className="manage-actions">
                <Button disabled={!blqTec || !blqIni || !blqFim || run.isPending} onClick={salvarBloqueio}>
                  {blqId ? <Check size={15} /> : <Plus size={15} />} {blqId ? "Salvar alteração" : "Adicionar bloqueio"}
                </Button>
                {blqId ? <Button variant="ghost" onClick={limparBloqueio}>Cancelar edição</Button> : null}
              </div>
            </div>
            <h3>Bloqueios do dia</h3>
            {bloqueios.isLoading ? <Skeleton /> : !bloqueios.data?.length ? <EmptyState compact title="Nenhum bloqueio neste dia" /> : (
              <ul className="manage-list">
                {bloqueios.data.map((b) => (
                  <li key={b.id}>
                    <div>
                      <strong>{nomeDe(b.tecnicoId)}</strong>
                      <span>{b.horaInicio}–{b.horaFim} · {rotulo(TIPOS_BLOQUEIO, b.tipo)}{b.descricao ? ` · ${b.descricao}` : ""}</span>
                      {b.finalizado ? <Badge tone="ok">Finalizado</Badge> : null}
                    </div>
                    <div className="manage-row-actions">
                      <Button size="icon" variant="ghost" aria-label="Editar" title="Editar" onClick={() => { setBlqId(b.id); setBlqTec(b.tecnicoId); setBlqTipo(b.tipo); setBlqIni(b.horaInicio); setBlqFim(b.horaFim); setBlqDesc(b.descricao || ""); }}>
                        <Pencil size={15} />
                      </Button>
                      {!installation && b.tipo === "outro" ? (
                        <Button size="sm" variant="outline" disabled={run.isPending} onClick={() => mutate(() => api.post(`/agenda-tecnicos/almocos/${b.id}/${b.finalizado ? "reabrir" : "terminar"}`))}>
                          {b.finalizado ? "Reabrir" : "Terminar chamado"}
                        </Button>
                      ) : null}
                      <ConfirmarRemocao disabled={run.isPending} onConfirm={() => mutate(() => api.delete(`${prefix}/almocos/${b.id}`), () => { if (blqId === b.id) limparBloqueio(); })} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
