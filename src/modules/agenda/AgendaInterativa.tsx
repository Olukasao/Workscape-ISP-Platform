import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { clients, errorMessage } from "../../services/api";
import { Button } from "../../components/ui/button";

// Interações direto na grade da agenda (como no app antigo): clicar no cabeçalho do técnico para
// ausência e equipe, clicar num horário vazio para adicionar bloqueio, clicar num bloqueio para editar.

export interface AusenciaRef {
  id?: number;
  ref: string; // id usado pela API (manutenção: o nome; instalação: o id)
  absence_reason: string;
  absence_note?: string | null;
  completed_at?: string | null;
}
export interface EquipeRef {
  id: number;
  technician_id: string;
  team_color: string;
}
export interface BloqueioRef {
  id?: number;
  ref: string;
  tipo?: string;
  descricao?: string | null;
  horaInicio: string;
  horaFim: string;
  finalizado?: boolean;
}

export const MOTIVOS_AUSENCIA: [string, string][] = [
  ["medico", "Médico"],
  ["ferias", "Férias"],
  ["atestado", "Atestado"],
  ["folga", "Folga"],
  ["mecanico", "Mecânico"],
  ["duplado", "DUPLADO"],
];
export const CORES_EQUIPE: [string, string, string][] = [
  ["azul", "Azul", "#2f6bff"],
  ["verde", "Verde", "#17b26a"],
  ["roxo", "Roxo", "#8b5cf6"],
  ["laranja", "Laranja", "#f97316"],
  ["vermelho", "Vermelho", "#e5484d"],
  ["cinza", "Cinza", "#64748b"],
];
export const TIPOS_BLOQUEIO: Record<string, { label: string; icon: string; placeholder: string }> = {
  almoco: { label: "Almoço", icon: "🍴", placeholder: "" },
  compromisso: { label: "Compromisso", icon: "📅", placeholder: "Consulta médica" },
  reuniao: { label: "Reunião", icon: "👥", placeholder: "Reunião com supervisor" },
  treinamento: { label: "Treinamento", icon: "🎓", placeholder: "Treinamento interno" },
  indisponivel: { label: "Indisponível", icon: "⛔", placeholder: "Motivo opcional" },
  outro: { label: "Outro", icon: "✏", placeholder: "Buscar equipamento no POP" },
};
const ORDEM_BLOQUEIO = ["almoco", "compromisso", "reuniao", "treinamento", "indisponivel", "outro"];
export const INICIO_AGENDA = 8 * 60;
const PASSO = 15;
const DURACAO_PADRAO = 60;
const toMin = (h: string) => {
  const [a, b] = h.split(":").map(Number);
  return Number.isFinite(a) && Number.isFinite(b) ? a * 60 + b : NaN;
};
const toHora = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const prefixo = (instalacao: boolean) => (instalacao ? "/agenda-instalacao" : "/agenda-tecnicos");

export type Alvo = { ref: string; nome: string };
export type Popup =
  | { kind: "ausencia"; dia: string; x: number; y: number; alvo: Alvo; atual?: AusenciaRef }
  | { kind: "equipe"; dia: string; x: number; y: number; alvo: Alvo; atual?: EquipeRef }
  | { kind: "novo-bloco"; dia: string; x: number; y: number; alvo: Alvo; inicio: number }
  | { kind: "acoes-bloco"; dia: string; x: number; y: number; alvo: Alvo; bloco: BloqueioRef }
  | { kind: "modal-bloco"; dia: string; alvo: Alvo; tipo: string; bloco?: BloqueioRef; inicio: number };

/** Calcula o início (em minutos) a partir do clique dentro da célula da hora. */
export function inicioPeloClique(event: { clientY: number; currentTarget: HTMLElement }, hora: number) {
  const rect = event.currentTarget.getBoundingClientRect();
  const altura = Math.max(1, rect.height || 50);
  const y = Math.max(0, Math.min(altura - 1, event.clientY - rect.top));
  const minuto = Math.floor(((y / altura) * 60) / PASSO) * PASSO;
  return hora * 60 + minuto;
}

function Popover({ x, y, onClose, children, label }: { x: number; y: number; onClose: () => void; children: ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      left: Math.max(10, Math.min(x, window.innerWidth - r.width - 10)),
      top: Math.max(10, Math.min(y, window.innerHeight - r.height - 10)),
    });
  }, [x, y]);
  useEffect(() => {
    const fora = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) onClose(); };
    const esc = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    // Registrado no próximo ciclo para o próprio clique que abriu o menu não fechá-lo.
    const timer = setTimeout(() => document.addEventListener("mousedown", fora), 0);
    document.addEventListener("keydown", esc);
    return () => { clearTimeout(timer); document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", esc); };
  }, [onClose]);
  return (
    <div ref={ref} className="ag-pop" role="menu" aria-label={label} style={{ left: pos.left, top: pos.top }} onClick={(e) => e.stopPropagation()}>
      {children}
    </div>
  );
}

export default function AgendaInterativa({
  popup,
  instalacao,
  onClose,
  onChanged,
  onOpen,
}: {
  popup: Popup;
  instalacao: boolean;
  onClose: () => void;
  onChanged: () => void;
  onOpen: (popup: Popup) => void;
}) {
  const api = clients.agenda;
  const date = popup.dia;
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const rodar = async (acao: () => Promise<unknown>) => {
    setErro("");
    setOcupado(true);
    try {
      await acao();
      onChanged();
      onClose();
    } catch (e) {
      setErro(errorMessage(e));
    } finally {
      setOcupado(false);
    }
  };

  // ---- Ausência (menu do cabeçalho)
  const [nota, setNota] = useState(popup.kind === "ausencia" ? popup.atual?.absence_note || "" : "");
  if (popup.kind === "ausencia") {
    const caminho = instalacao ? "/agenda-instalacao/ausencias" : "/technician-absences";
    const salvar = (motivo: string) =>
      rodar(() => api.post(caminho, { technician_id: popup.alvo.ref, absence_date: date, absence_reason: motivo, absence_note: nota.trim() }));
    const motivos = MOTIVOS_AUSENCIA.filter(([k]) => !instalacao || k !== "duplado");
    const atual = popup.atual;
    return (
      <Popover x={popup.x} y={popup.y} onClose={onClose} label="Motivo da ausência">
        <p className="ag-pop-title">Motivo da ausência<br /><small>{popup.alvo.nome}</small></p>
        <div className="ag-pop-options">
          {motivos.map(([k, l]) => (
            <button key={k} type="button" data-active={atual?.absence_reason === k} disabled={ocupado} onClick={() => void salvar(k)}>{l}</button>
          ))}
        </div>
        <input
          className="ag-pop-input"
          aria-label="Observação curta"
          maxLength={80}
          placeholder="Observação curta"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void salvar(atual?.absence_reason || "outro"); }}
        />
        <button type="button" className="ag-pop-wide" disabled={ocupado} onClick={() => void salvar("outro")}>Outro</button>
        {!instalacao && atual?.absence_reason === "outro" && !atual.completed_at && atual.id ? (
          <button type="button" className="ag-pop-wide" disabled={ocupado} onClick={() => void rodar(() => api.post(`${caminho}/${atual.id}/complete`))}>Terminar chamado</button>
        ) : null}
        {atual?.id ? (
          <button type="button" className="ag-pop-wide ag-pop-danger" disabled={ocupado} onClick={() => void rodar(() => api.delete(`${caminho}/${atual.id}`))}>Remover motivo</button>
        ) : null}
        {erro ? <p className="inline-error" role="alert">{erro}</p> : null}
      </Popover>
    );
  }

  // ---- Equipe (menu do cabeçalho)
  if (popup.kind === "equipe") {
    const atual = popup.atual;
    return (
      <Popover x={popup.x} y={popup.y} onClose={onClose} label="Cor da equipe">
        <p className="ag-pop-title">Cor da equipe<br /><small>{popup.alvo.nome}</small></p>
        <div className="ag-pop-options">
          {CORES_EQUIPE.map(([k, l, hex]) => (
            <button
              key={k}
              type="button"
              data-active={atual?.team_color === k}
              disabled={ocupado}
              style={{ "--cor": hex } as React.CSSProperties}
              onClick={() => void rodar(() => api.post("/technician-team-colors", { technician_id: popup.alvo.ref, team_date: date, team_color: k }))}
            >
              <i aria-hidden="true" />{l}
            </button>
          ))}
        </div>
        <button type="button" className="ag-pop-wide ag-pop-danger" disabled={ocupado || !atual} onClick={() => atual && void rodar(() => api.delete(`/technician-team-colors/${atual.id}`))}>Remover cor</button>
        {erro ? <p className="inline-error" role="alert">{erro}</p> : null}
      </Popover>
    );
  }

  // ---- Clique em horário vazio: escolher o tipo de bloqueio
  if (popup.kind === "novo-bloco") {
    return (
      <Popover x={popup.x} y={popup.y} onClose={onClose} label="Adicionar ao horário">
        <p className="ag-pop-title">Adicionar ao horário<br /><small>{popup.alvo.nome} · {toHora(popup.inicio)}</small></p>
        {ORDEM_BLOQUEIO.filter((k) => !instalacao || k !== "outro").map((k) => (
          <button key={k} type="button" className="ag-pop-item" onClick={() => onOpen({ kind: "modal-bloco", dia: popup.dia, alvo: popup.alvo, tipo: k, inicio: popup.inicio })}>
            <span aria-hidden="true">{TIPOS_BLOQUEIO[k].icon}</span>{TIPOS_BLOQUEIO[k].label}
          </button>
        ))}
      </Popover>
    );
  }

  // ---- Clique num bloqueio existente
  if (popup.kind === "acoes-bloco") {
    const b = popup.bloco;
    const cfg = TIPOS_BLOQUEIO[b.tipo || "almoco"] || TIPOS_BLOQUEIO.almoco;
    const almoco = (b.tipo || "almoco") === "almoco";
    const caminho = `${prefixo(instalacao)}/almocos`;
    return (
      <Popover x={popup.x} y={popup.y} onClose={onClose} label="Ações do bloqueio">
        <p className="ag-pop-title">{cfg.label}<br /><small>{popup.alvo.nome} · {b.horaInicio} às {b.horaFim}{b.descricao ? ` · ${b.descricao}` : ""}</small></p>
        <button type="button" className="ag-pop-item" onClick={() => onOpen({ kind: "modal-bloco", dia: popup.dia, alvo: popup.alvo, tipo: b.tipo || "almoco", bloco: b, inicio: toMin(b.horaInicio) })}>
          <span aria-hidden="true">{cfg.icon}</span>{almoco ? "Editar horário" : "Visualizar/editar"}
        </button>
        {!instalacao && b.tipo === "outro" && b.id ? (
          <button type="button" className="ag-pop-item" disabled={ocupado} onClick={() => void rodar(() => api.post(`${caminho}/${b.id}/${b.finalizado ? "reabrir" : "terminar"}`))}>
            <span aria-hidden="true">{b.finalizado ? "↶" : "✓"}</span>{b.finalizado ? "Reabrir chamado" : "Terminar chamado"}
          </button>
        ) : null}
        {b.id ? (
          <button type="button" className="ag-pop-item ag-pop-danger" disabled={ocupado} onClick={() => void rodar(() => api.delete(`${caminho}/${b.id}`))}>
            <span aria-hidden="true">✕</span>{almoco ? "Remover almoço" : "Excluir bloqueio"}
          </button>
        ) : null}
        <button type="button" className="ag-pop-wide" onClick={onClose}>Cancelar</button>
        {erro ? <p className="inline-error" role="alert">{erro}</p> : null}
      </Popover>
    );
  }

  return <BloqueioModal popup={popup} date={date} instalacao={instalacao} rodar={rodar} onClose={onClose} erro={erro} ocupado={ocupado} />;
}

function BloqueioModal({
  popup, date, instalacao, rodar, onClose, erro, ocupado,
}: {
  popup: Extract<Popup, { kind: "modal-bloco" }>;
  date: string;
  instalacao: boolean;
  rodar: (acao: () => Promise<unknown>) => Promise<void>;
  onClose: () => void;
  erro: string;
  ocupado: boolean;
}) {
  const api = clients.agenda;
  const limite = (instalacao ? 21 : 24) * 60 - 1;
  const edicao = !!popup.bloco;
  const [tipo, setTipo] = useState(popup.tipo);
  const [ini, setIni] = useState(popup.bloco?.horaInicio || toHora(popup.inicio));
  const [fim, setFim] = useState(popup.bloco?.horaFim || toHora(Math.min(popup.inicio + DURACAO_PADRAO, limite)));
  const [descricao, setDescricao] = useState(popup.bloco?.descricao || "");
  const [aviso, setAviso] = useState("");
  const fimRef = useRef<HTMLInputElement>(null);
  const cfg = TIPOS_BLOQUEIO[tipo] || TIPOS_BLOQUEIO.almoco;
  const almoco = tipo === "almoco";
  useEffect(() => {
    const esc = (event: KeyboardEvent) => { if (event.key === "Escape" && !ocupado) onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose, ocupado]);
  const duracao = (minutos: number | "personalizado") => {
    if (minutos === "personalizado") { fimRef.current?.focus(); return; }
    const a = toMin(ini);
    if (Number.isFinite(a)) setFim(toHora(Math.min(a + minutos, limite)));
  };
  const salvar = (event: React.FormEvent) => {
    event.preventDefault();
    const a = toMin(ini), b = toMin(fim);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return setAviso("Informe os horários no formato HH:MM.");
    if (b <= a) return setAviso("O horário final precisa ser maior que o horário inicial.");
    if (a < INICIO_AGENDA || b > limite + 1) return setAviso("O horário informado está fora do intervalo exibido pela agenda.");
    setAviso("");
    const caminho = `${prefixo(instalacao)}/almocos`;
    const body = { tecnicoId: popup.alvo.ref, data: date, tipo, horaInicio: ini, horaFim: fim, ...(almoco ? {} : { descricao: descricao.trim() }) };
    void rodar(() => (edicao && popup.bloco?.id ? api.put(`${caminho}/${popup.bloco.id}`, body) : api.post(caminho, body)));
  };
  const dia = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !ocupado) onClose(); }}>
      <form className="confirm-dialog ag-modal" role="dialog" aria-modal="true" aria-label={almoco ? (edicao ? "Editar almoço" : "Marcar almoço") : (edicao ? "Editar bloqueio" : "Adicionar bloqueio")} onSubmit={salvar}>
        <h2>{cfg.icon} {almoco ? (edicao ? "Editar almoço" : "Marcar almoço") : `${edicao ? "Editar" : "Adicionar"} ${cfg.label.toLocaleLowerCase("pt-BR")}`}</h2>
        <p className="ag-modal-resumo"><strong>{popup.alvo.nome}</strong> · <span style={{ textTransform: "capitalize" }}>{dia}</span></p>
        {edicao && !almoco ? (
          <label className="field"><span>Tipo</span>
            <select aria-label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {ORDEM_BLOQUEIO.filter((k) => k !== "almoco" && (!instalacao || k !== "outro")).map((k) => <option key={k} value={k}>{TIPOS_BLOQUEIO[k].label}</option>)}
            </select>
          </label>
        ) : null}
        {!almoco ? (
          <label className="field"><span>Descrição</span>
            <textarea aria-label="Descrição" maxLength={255} placeholder={cfg.placeholder || "Descrição"} value={descricao} onChange={(e) => setDescricao(e.target.value)} autoFocus={!edicao} />
          </label>
        ) : null}
        <div className="ag-modal-horas">
          <label className="field"><span>Início</span><input aria-label="Início" type="time" step={60} required value={ini} onChange={(e) => setIni(e.target.value)} /></label>
          <label className="field"><span>Fim</span><input aria-label="Fim" ref={fimRef} type="time" step={60} required value={fim} onChange={(e) => setFim(e.target.value)} /></label>
        </div>
        {!almoco ? (
          <div className="ag-modal-duracao" role="group" aria-label="Duração rápida">
            <span>Duração rápida</span>
            {([[30, "30 min"], [60, "1h"], [90, "1h30"], [120, "2h"]] as const).map(([m, l]) => (
              <button key={m} type="button" onClick={() => duracao(m)}>{l}</button>
            ))}
            <button type="button" onClick={() => duracao("personalizado")}>Personalizado</button>
          </div>
        ) : null}
        {aviso || erro ? <p className="inline-error" role="alert">{aviso || erro}</p> : null}
        <div className="confirm-actions">
          <Button type="button" variant="outline" disabled={ocupado} onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={ocupado}>{ocupado ? "Salvando…" : "Salvar"}</Button>
        </div>
      </form>
    </div>
  );
}
