import { useState } from "react";
import { ArrowDown, ArrowUp, Copy, Plus, Trash2, X } from "lucide-react";
import { clsx } from "clsx";
import { Campo, mover, novoId, useConfirmar } from "./comum";

export interface Questao { id: string; tipo: string; enunciado: string; pontos: number; obrigatoria: boolean; opcoes?: { id: string; texto: string }[]; correta?: any; pares?: { id: string; esq: string; dir: string }[]; itens?: { id: string; texto: string }[]; aceitas?: string[]; criterio?: string }
export interface ProvaEd {
  titulo: string; notaMinima: number; maxTentativas: number; tempoLimiteMin: number; embaralharQuestoes: boolean; embaralharAlternativas: boolean;
  feedback: "imediato" | "final" | "nunca"; liberaProxima: boolean; peso: number; questoes: Questao[];
}
export const TIPOS: Record<string, string> = {
  unica: "Múltipla escolha (uma correta)", multipla: "Múltipla escolha (várias corretas)", vf: "Verdadeiro ou falso", associacao: "Associação",
  ordenacao: "Ordenação de etapas", curta: "Resposta curta", discursiva: "Discursiva (correção manual)",
};

export function novaQuestao(tipo: string): Questao {
  const base = { id: novoId(), tipo, enunciado: "", pontos: 10, obrigatoria: false };
  if (tipo === "unica" || tipo === "multipla") { const a = novoId(), b = novoId(); return { ...base, opcoes: [{ id: a, texto: "" }, { id: b, texto: "" }], correta: [a] }; }
  if (tipo === "vf") return { ...base, correta: true };
  if (tipo === "associacao") return { ...base, pares: [{ id: novoId(), esq: "", dir: "" }, { id: novoId(), esq: "", dir: "" }] };
  if (tipo === "ordenacao") return { ...base, itens: [{ id: novoId(), texto: "" }, { id: novoId(), texto: "" }] };
  if (tipo === "curta") return { ...base, aceitas: [""] };
  return { ...base, criterio: "" };
}

function Opcoes({ q, set }: { q: Questao; set: (q: Questao) => void }) {
  const unica = q.tipo === "unica";
  const corretas: string[] = q.correta ?? [];
  const alternar = (id: string) => set({ ...q, correta: unica ? [id] : corretas.includes(id) ? corretas.filter((x) => x !== id) : [...corretas, id] });
  return (
    <div className="ed-opcoes">
      {q.opcoes!.map((o, i) => (
        <div key={o.id} className="linha">
          <input type={unica ? "radio" : "checkbox"} name={`c-${q.id}`} checked={corretas.includes(o.id)} onChange={() => alternar(o.id)} aria-label={`Alternativa ${i + 1} é correta`} />
          <input value={o.texto} maxLength={500} placeholder={`Alternativa ${i + 1}`} onChange={(e) => set({ ...q, opcoes: q.opcoes!.map((x) => (x.id === o.id ? { ...x, texto: e.target.value } : x)) })} />
          <button type="button" className="btn btn--ghost btn--icon-sm" aria-label="Remover alternativa" disabled={q.opcoes!.length <= 2} onClick={() => set({ ...q, opcoes: q.opcoes!.filter((x) => x.id !== o.id), correta: corretas.filter((x) => x !== o.id) })}><X size={14} /></button>
        </div>
      ))}
      {q.opcoes!.length < 10 && <button type="button" className="btn btn--outline btn--sm" onClick={() => set({ ...q, opcoes: [...q.opcoes!, { id: novoId(), texto: "" }] })}><Plus size={14} /> Alternativa</button>}
      <small className="mudo">{unica ? "Marque a alternativa correta." : "Marque todas as corretas."}</small>
    </div>
  );
}

function CorpoQuestao({ q, set }: { q: Questao; set: (q: Questao) => void }) {
  switch (q.tipo) {
    case "unica": case "multipla": return <Opcoes q={q} set={set} />;
    case "vf": return <div className="cb-vf">{[true, false].map((v) => <label key={String(v)} className="campo-check"><input type="radio" checked={q.correta === v} onChange={() => set({ ...q, correta: v })} /> {v ? "Verdadeiro" : "Falso"} é a resposta correta</label>)}</div>;
    case "associacao":
      return (
        <div className="ed-opcoes">
          {q.pares!.map((p) => (
            <div key={p.id} className="linha">
              <input value={p.esq} placeholder="Item" onChange={(e) => set({ ...q, pares: q.pares!.map((x) => (x.id === p.id ? { ...x, esq: e.target.value } : x)) })} />
              <span aria-hidden="true">↔</span>
              <input value={p.dir} placeholder="Correspondente" onChange={(e) => set({ ...q, pares: q.pares!.map((x) => (x.id === p.id ? { ...x, dir: e.target.value } : x)) })} />
              <button type="button" className="btn btn--ghost btn--icon-sm" aria-label="Remover par" disabled={q.pares!.length <= 2} onClick={() => set({ ...q, pares: q.pares!.filter((x) => x.id !== p.id) })}><X size={14} /></button>
            </div>
          ))}
          {q.pares!.length < 12 && <button type="button" className="btn btn--outline btn--sm" onClick={() => set({ ...q, pares: [...q.pares!, { id: novoId(), esq: "", dir: "" }] })}><Plus size={14} /> Par</button>}
          <small className="mudo">O aluno verá os itens à esquerda e as opções embaralhadas à direita.</small>
        </div>
      );
    case "ordenacao":
      return (
        <div className="ed-opcoes">
          {q.itens!.map((it, i) => (
            <div key={it.id} className="linha"><b>{i + 1}.</b>
              <input value={it.texto} placeholder={`Etapa ${i + 1}`} onChange={(e) => set({ ...q, itens: q.itens!.map((x) => (x.id === it.id ? { ...x, texto: e.target.value } : x)) })} />
              <button type="button" className="btn btn--ghost btn--icon-sm" aria-label="Subir" disabled={i === 0} onClick={() => set({ ...q, itens: mover(q.itens!, i, i - 1) })}><ArrowUp size={14} /></button>
              <button type="button" className="btn btn--ghost btn--icon-sm" aria-label="Descer" disabled={i === q.itens!.length - 1} onClick={() => set({ ...q, itens: mover(q.itens!, i, i + 1) })}><ArrowDown size={14} /></button>
              <button type="button" className="btn btn--ghost btn--icon-sm" aria-label="Remover etapa" disabled={q.itens!.length <= 2} onClick={() => set({ ...q, itens: q.itens!.filter((x) => x.id !== it.id) })}><X size={14} /></button>
            </div>
          ))}
          {q.itens!.length < 12 && <button type="button" className="btn btn--outline btn--sm" onClick={() => set({ ...q, itens: [...q.itens!, { id: novoId(), texto: "" }] })}><Plus size={14} /> Etapa</button>}
          <small className="mudo">Escreva as etapas na ordem correta; o aluno as verá embaralhadas.</small>
        </div>
      );
    case "curta":
      return (
        <div className="ed-opcoes">
          {q.aceitas!.map((a, i) => (
            <div key={i} className="linha"><input value={a} placeholder="Resposta aceita" onChange={(e) => set({ ...q, aceitas: q.aceitas!.map((x, k) => (k === i ? e.target.value : x)) })} />
              <button type="button" className="btn btn--ghost btn--icon-sm" aria-label="Remover" disabled={q.aceitas!.length <= 1} onClick={() => set({ ...q, aceitas: q.aceitas!.filter((_, k) => k !== i) })}><X size={14} /></button></div>
          ))}
          <button type="button" className="btn btn--outline btn--sm" onClick={() => set({ ...q, aceitas: [...q.aceitas!, ""] })}><Plus size={14} /> Outra resposta aceita</button>
          <small className="mudo">Maiúsculas, acentos e espaços extras não importam.</small>
        </div>
      );
    default:
      return <Campo rotulo="Critério de correção (só o corretor vê)"><textarea rows={3} value={q.criterio ?? ""} onChange={(e) => set({ ...q, criterio: e.target.value })} /></Campo>;
  }
}

export default function EditorProva({ prova, onChange }: { prova: ProvaEd; onChange: (p: ProvaEd) => void }) {
  const [tipo, setTipo] = useState("unica");
  const { pedir, dialogo } = useConfirmar();
  const set = <K extends keyof ProvaEd>(k: K, v: ProvaEd[K]) => onChange({ ...prova, [k]: v });
  const setQ = (i: number, q: Questao) => set("questoes", prova.questoes.map((x, k) => (k === i ? q : x)));
  const total = prova.questoes.reduce((s, q) => s + q.pontos, 0);
  return (
    <div className="editor-prova">
      <div className="form-grade">
        <Campo rotulo="Nota mínima para aprovação (0 a 100)"><input type="number" min={0} max={100} value={prova.notaMinima} onChange={(e) => set("notaMinima", Number(e.target.value))} /></Campo>
        <Campo rotulo="Tentativas permitidas" dica="0 = ilimitadas."><input type="number" min={0} max={100} value={prova.maxTentativas} onChange={(e) => set("maxTentativas", Number(e.target.value))} /></Campo>
        <Campo rotulo="Tempo limite (minutos)" dica="0 = sem limite. Conferido no servidor."><input type="number" min={0} max={600} value={prova.tempoLimiteMin} onChange={(e) => set("tempoLimiteMin", Number(e.target.value))} /></Campo>
        <Campo rotulo="Peso na média final"><input type="number" min={1} max={100} value={prova.peso} onChange={(e) => set("peso", Number(e.target.value))} /></Campo>
        <Campo rotulo="Mostrar acertos e erros">
          <select value={prova.feedback} onChange={(e) => set("feedback", e.target.value as ProvaEd["feedback"])}>
            <option value="final">Somente após finalizar a prova</option><option value="imediato">A cada resposta (o aluno confere durante a prova)</option><option value="nunca">Nunca (só a nota)</option>
          </select>
        </Campo>
      </div>
      <div className="form-checks">
        <label><input type="checkbox" checked={prova.embaralharQuestoes} onChange={(e) => set("embaralharQuestoes", e.target.checked)} /> Embaralhar a ordem das questões</label>
        <label><input type="checkbox" checked={prova.embaralharAlternativas} onChange={(e) => set("embaralharAlternativas", e.target.checked)} /> Embaralhar as alternativas</label>
        <label><input type="checkbox" checked={prova.liberaProxima} onChange={(e) => set("liberaProxima", e.target.checked)} /> A próxima aula só libera com a aprovação</label>
      </div>
      <p className="mudo">{prova.questoes.length} questões · {total} pontos no total. A nota é calculada em 100 pela proporção de pontos.</p>
      <ol className="ed-questoes">
        {prova.questoes.map((q, i) => (
          <li key={q.id} className="ed-questao">
            <header><b>{i + 1}</b><span className="tipo">{TIPOS[q.tipo]}</span><span className="grow" />
              <label className="campo-check"><input type="checkbox" checked={q.obrigatoria} onChange={(e) => setQ(i, { ...q, obrigatoria: e.target.checked })} /> Obrigatória</label>
              <label className="pontos">Pontos <input type="number" min={1} max={1000} value={q.pontos} onChange={(e) => setQ(i, { ...q, pontos: Number(e.target.value) })} /></label>
              <button type="button" className="btn btn--ghost btn--icon-sm" aria-label="Subir" disabled={i === 0} onClick={() => set("questoes", mover(prova.questoes, i, i - 1))}><ArrowUp size={14} /></button>
              <button type="button" className="btn btn--ghost btn--icon-sm" aria-label="Descer" disabled={i === prova.questoes.length - 1} onClick={() => set("questoes", mover(prova.questoes, i, i + 1))}><ArrowDown size={14} /></button>
              <button type="button" className="btn btn--ghost btn--icon-sm" aria-label="Duplicar" onClick={() => set("questoes", [...prova.questoes.slice(0, i + 1), JSON.parse(JSON.stringify({ ...q, id: novoId() })), ...prova.questoes.slice(i + 1)])}><Copy size={14} /></button>
              <button type="button" className="btn btn--ghost btn--icon-sm" aria-label="Excluir questão" onClick={() => pedir("Excluir questão", `A questão ${i + 1} será removida.`, () => set("questoes", prova.questoes.filter((x) => x.id !== q.id)))}><Trash2 size={14} /></button>
            </header>
            <textarea className="enunciado" rows={2} maxLength={3000} placeholder="Enunciado da questão" value={q.enunciado} onChange={(e) => setQ(i, { ...q, enunciado: e.target.value })} />
            <CorpoQuestao q={q} set={(n) => setQ(i, n)} />
          </li>
        ))}
      </ol>
      <div className={clsx("ed-nova-questao")}>
        <select aria-label="Tipo da nova questão" value={tipo} onChange={(e) => setTipo(e.target.value)}>{Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <button type="button" className="btn btn--primary" onClick={() => set("questoes", [...prova.questoes, novaQuestao(tipo)])}><Plus size={15} /> Adicionar questão</button>
      </div>
      {dialogo}
    </div>
  );
}
