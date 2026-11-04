import { useCallback, useEffect, useState } from "react";
import { AlarmClock, BellRing, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "../components/ui/button";
import BotaoDitado from "../components/BotaoDitado";
import { EmptyState, PageHeader } from "../components/ui/primitives";
import { DIAS, erroDe, lembretesApi, regraVazia, rotuloQuando, useAlarmes, type Lembrete, type Regra, type Tipo } from "../services/lembretes";

const EXEMPLOS = [
  "Beber água todos os dias às 9h e às 15h",
  "De segunda a sexta às 8:30 abrir a fila de suporte",
  "Dia 5 de cada mês às 10h conferir o fechamento",
  "Amanhã às 14h ligar para o cliente João",
];
const TIPOS: { id: Tipo; rotulo: string }[] = [
  { id: "unico", rotulo: "Uma vez" },
  { id: "diario", rotulo: "Todos os dias" },
  { id: "semanal", rotulo: "Dias da semana" },
  { id: "mensal", rotulo: "Todo mês" },
];
const amanha = () => { const d = new Date(Date.now() + 86400000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

/** Editor de um lembrete: serve para o que a IA montou e para criar ou editar na mão. */
function Editor({ regra, onChange, onRemover }: { regra: Regra; onChange: (r: Regra) => void; onRemover?: () => void }) {
  const [hora, setHora] = useState("");
  const [horaInvalida, setHoraInvalida] = useState(false);
  const mudar = (parcial: Partial<Regra>) => onChange({ ...regra, ...parcial });
  const mascara = (digitos: string) => (digitos.length <= 2 ? digitos : `${digitos.slice(0, 2)}:${digitos.slice(2)}`);
  // O horário digitado entra na lista sozinho: ao completar 4 dígitos, ao apertar Enter ou ao sair do campo (por exemplo, para clicar em Salvar).
  const confirmar = (texto: string) => {
    const d = texto.replace(/\D/g, "").slice(0, 4);
    if (!d) { setHora(""); setHoraInvalida(false); return; }
    const hh = d.length <= 2 ? d : d.length === 3 ? `0${d[0]}` : d.slice(0, 2);
    const mm = d.length <= 2 ? "00" : d.slice(d.length === 3 ? 1 : 2);
    if (Number(hh) > 23 || Number(mm) > 59) { setHoraInvalida(true); return; }
    const valor = `${hh.padStart(2, "0")}:${mm.padStart(2, "0")}`;
    if (!regra.horarios.includes(valor) && regra.horarios.length < 8) mudar({ horarios: [...regra.horarios, valor].sort() });
    setHora("");
    setHoraInvalida(false);
  };
  return (
    <div className="lembrete-editor">
      <div className="lembrete-editor-topo">
        <label className="lembrete-campo lembrete-campo-grande">
          <span>Mensagem do alarme</span>
          <input value={regra.texto} maxLength={300} placeholder="Ex.: Beber água" onChange={(e) => mudar({ texto: e.target.value })} />
        </label>
        {onRemover ? <button type="button" className="lembrete-icone" onClick={onRemover} aria-label="Descartar este lembrete"><X size={16} /></button> : null}
      </div>

      <div className="lembrete-campo">
        <span id="freq-rotulo">Quando repetir</span>
        <div className="lembrete-segmentos" role="radiogroup" aria-labelledby="freq-rotulo">
          {TIPOS.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={regra.tipo === t.id} className={regra.tipo === t.id ? "on" : ""}
              onClick={() => mudar({ tipo: t.id, data: t.id === "unico" ? regra.data || amanha() : regra.data })}>{t.rotulo}</button>
          ))}
        </div>
      </div>

      {regra.tipo === "semanal" && (
        <div className="lembrete-campo">
          <span>Nos dias</span>
          <div className="lembrete-dias">
            {DIAS.map((nome, i) => (
              <button key={nome} type="button" aria-pressed={regra.dias_semana.includes(i)} className={regra.dias_semana.includes(i) ? "on" : ""}
                onClick={() => mudar({ dias_semana: regra.dias_semana.includes(i) ? regra.dias_semana.filter((d) => d !== i) : [...regra.dias_semana, i].sort() })}>{nome}</button>
            ))}
          </div>
        </div>
      )}
      {regra.tipo === "mensal" && (
        <label className="lembrete-campo lembrete-campo-curto">
          <span>No dia do mês</span>
          <input type="number" min={1} max={31} value={regra.dia_mes ?? 1} onChange={(e) => mudar({ dia_mes: Number(e.target.value) })} />
        </label>
      )}
      {regra.tipo === "unico" && (
        <label className="lembrete-campo lembrete-campo-curto">
          <span>Na data</span>
          <input type="date" value={regra.data || ""} onChange={(e) => mudar({ data: e.target.value })} />
        </label>
      )}

      <div className="lembrete-campo">
        <span>Nos horários</span>
        <div className="lembrete-horas">
          {regra.horarios.map((h) => (
            <span key={h} className="lembrete-hora">{h}
              <button type="button" aria-label={`Remover ${h}`} onClick={() => mudar({ horarios: regra.horarios.filter((x) => x !== h) })}><X size={12} /></button>
            </span>
          ))}
          {regra.horarios.length < 8 && (
            <input
              className={`lembrete-hora-campo${horaInvalida ? " invalido" : ""}`}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={5}
              aria-label="Digitar um horário"
              aria-invalid={horaInvalida}
              placeholder={regra.horarios.length ? "Outro horário" : "Ex.: 0900"}
              value={hora}
              onChange={(e) => {
                const d = e.target.value.replace(/\D/g, "").slice(0, 4);
                setHora(mascara(d));
                setHoraInvalida(false);
                if (d.length === 4) confirmar(d);
              }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmar(hora); } }}
              onBlur={() => confirmar(hora)}
            />
          )}
        </div>
        <small className={`lembrete-dica${horaInvalida ? " erro" : ""}`}>
          {horaInvalida ? "Esse horário não existe. Use de 00:00 a 23:59." : "Digite o horário com 4 números, por exemplo 0900 para 9 da manhã. Ele entra sozinho na lista."}
        </small>
      </div>
    </div>
  );
}

export default function Lembretes() {
  const [lista, setLista] = useState<Lembrete[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [pedido, setPedido] = useState("");
  const [entendendo, setEntendendo] = useState(false);
  const [rascunhos, setRascunhos] = useState<Regra[]>([]);
  const [editando, setEditando] = useState<{ id: number | null; regra: Regra } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const testar = useAlarmes((s) => s.testar);

  const carregar = useCallback(async () => {
    try { setLista(await lembretesApi.listar()); } catch (e) { setErro(erroDe(e, "Não foi possível carregar seus lembretes.")); } finally { setCarregando(false); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  const entender = async () => {
    if (pedido.trim().length < 4 || entendendo) return;
    setEntendendo(true); setErro("");
    try {
      const itens = await lembretesApi.interpretar(pedido.trim());
      setRascunhos(itens.map(({ descricao: _d, ...r }) => r));
    } catch (e) { setErro(erroDe(e, "A IA não conseguiu entender agora. Tente de novo.")); } finally { setEntendendo(false); }
  };
  const salvarRascunhos = async () => {
    setSalvando(true); setErro("");
    try { await lembretesApi.criar(rascunhos); setRascunhos([]); setPedido(""); await carregar(); } catch (e) { setErro(erroDe(e, "Não foi possível salvar.")); } finally { setSalvando(false); }
  };
  const salvarEdicao = async () => {
    if (!editando) return;
    setSalvando(true); setErro("");
    try {
      if (editando.id) await lembretesApi.editar(editando.id, editando.regra); else await lembretesApi.criar([editando.regra]);
      setEditando(null); await carregar();
    } catch (e) { setErro(erroDe(e, "Não foi possível salvar.")); } finally { setSalvando(false); }
  };
  const alternar = async (l: Lembrete) => {
    setErro("");
    try { await lembretesApi.ativar(l.id, !l.ativo); await carregar(); } catch (e) { setErro(erroDe(e, "Não foi possível alterar o lembrete.")); }
  };
  const excluir = async (l: Lembrete) => {
    if (!window.confirm(`Excluir o lembrete "${l.texto}"?`)) return;
    try { await lembretesApi.excluir(l.id); await carregar(); } catch (e) { setErro(erroDe(e, "Não foi possível excluir.")); }
  };

  const ativos = lista.filter((l) => l.ativo);
  const pausados = lista.filter((l) => !l.ativo);

  return (
    <div className="page lembretes-page">
      <PageHeader
        icon={AlarmClock}
        title="Lembretes"
        description="Escreva o que quer lembrar e quando. A IA monta o alarme, que toca aqui no app."
        meta={<button type="button" className="lembrete-link" onClick={testar}>Testar o alarme</button>}
      />

      <section className="lembrete-criar" aria-label="Criar lembretes">
        <label htmlFor="pedido-lembrete" className="lembrete-criar-titulo"><Sparkles size={16} aria-hidden="true" /> O que você quer lembrar?</label>
        <textarea
          id="pedido-lembrete"
          rows={2}
          value={pedido}
          maxLength={800}
          placeholder="Ex.: me lembre de beber água todos os dias às 9h e às 15h"
          onChange={(e) => setPedido(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void entender(); } }}
        />
        <div className="lembrete-exemplos" aria-label="Exemplos">
          {EXEMPLOS.map((x) => <button key={x} type="button" onClick={() => setPedido(x)}>{x}</button>)}
        </div>
        <div className="lembrete-criar-acoes">
          <Button onClick={entender} disabled={pedido.trim().length < 4 || entendendo}>
            <Sparkles size={16} aria-hidden="true" /> {entendendo ? "A IA está entendendo…" : "Criar com IA"}
          </Button>
          <Button variant="outline" onClick={() => setEditando({ id: null, regra: regraVazia() })}><Plus size={16} aria-hidden="true" /> Criar manualmente</Button>
          <BotaoDitado aoTexto={(t) => setPedido((p) => (p.trim() ? `${p.trim()} ${t}` : t).slice(0, 800))} />
        </div>
      </section>

      {erro ? <p className="inline-error" role="alert">{erro}</p> : null}

      {rascunhos.length > 0 && (
        <section className="lembrete-rascunhos" aria-label="Conferir lembretes">
          <h2>A IA entendeu {rascunhos.length === 1 ? "este lembrete" : `estes ${rascunhos.length} lembretes`}. Confira e salve.</h2>
          {rascunhos.map((r, i) => (
            <Editor key={i} regra={r} onChange={(n) => setRascunhos((l) => l.map((x, j) => (j === i ? n : x)))} onRemover={() => setRascunhos((l) => l.filter((_, j) => j !== i))} />
          ))}
          <div className="lembrete-criar-acoes">
            <Button onClick={salvarRascunhos} disabled={salvando}>{salvando ? "Salvando…" : rascunhos.length === 1 ? "Salvar lembrete" : "Salvar lembretes"}</Button>
            <Button variant="ghost" onClick={() => setRascunhos([])}>Descartar</Button>
          </div>
        </section>
      )}

      {carregando ? null : lista.length === 0 && rascunhos.length === 0 ? (
        <EmptyState icon={BellRing} title="Nenhum lembrete ainda">Escreva acima o que quer lembrar e a IA monta o alarme para você.</EmptyState>
      ) : (
        <>
          {[["Ativos", ativos], ["Pausados", pausados]].map(([titulo, itens]) => (itens as Lembrete[]).length > 0 && (
            <section key={titulo as string} className="lembrete-grupo" aria-label={titulo as string}>
              <h2>{titulo as string} <span>{(itens as Lembrete[]).length}</span></h2>
              <ul>
                {(itens as Lembrete[]).map((l) => (
                  <li key={l.id} className={l.ativo ? "" : "pausado"}>
                    <div className="lembrete-item-texto">
                      <strong>{l.texto}</strong>
                      <span>{l.descricao}</span>
                      {l.ativo && l.proximo ? <em>Próximo: {rotuloQuando(l.proximo)}</em> : null}
                    </div>
                    <button type="button" role="switch" aria-checked={l.ativo} aria-label={`${l.ativo ? "Pausar" : "Ativar"}: ${l.texto}`} className={`lembrete-switch${l.ativo ? " on" : ""}`} onClick={() => alternar(l)}><i /></button>
                    <button type="button" className="lembrete-icone" aria-label={`Editar: ${l.texto}`} onClick={() => setEditando({ id: l.id, regra: { texto: l.texto, tipo: l.tipo, horarios: l.horarios, dias_semana: l.dias_semana, dia_mes: l.dia_mes, data: l.data, avisar_chat: l.avisar_chat } })}><Pencil size={15} /></button>
                    <button type="button" className="lembrete-icone perigo" aria-label={`Excluir: ${l.texto}`} onClick={() => excluir(l)}><Trash2 size={15} /></button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}

      {editando && (
        <div className="modal-backdrop" onClick={() => !salvando && setEditando(null)}>
          <section className="confirm-dialog lembrete-dialogo" role="dialog" aria-modal="true" aria-label={editando.id ? "Editar lembrete" : "Novo lembrete"} onClick={(e) => e.stopPropagation()}>
            <div className="lembrete-dialogo-topo">
              <h2>{editando.id ? "Editar lembrete" : "Novo lembrete"}</h2>
              <button type="button" className="lembrete-icone" onClick={() => setEditando(null)} aria-label="Fechar"><X size={18} /></button>
            </div>
            <Editor regra={editando.regra} onChange={(regra) => setEditando({ ...editando, regra })} />
            {erro ? <p className="inline-error" role="alert">{erro}</p> : null}
            <div className="lembrete-criar-acoes">
              <Button onClick={salvarEdicao} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</Button>
              <Button variant="ghost" onClick={() => setEditando(null)}>Cancelar</Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
