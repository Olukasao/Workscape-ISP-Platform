import { useState } from "react";
import { Bot, ListChecks, Send, Sparkles } from "lucide-react";
import { cursosApi, errorMessage } from "./api";

// Ajuda de IA dentro da aula: resumo para revisar e tira-dúvidas que responde só com o conteúdo desta aula.
interface Msg { role: "user" | "assistant"; content: string }

export default function TutorIA({ aulaId }: { aulaId: number }) {
  const [aberto, setAberto] = useState(false);
  const [resumo, setResumo] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [pergunta, setPergunta] = useState("");
  const [ocupado, setOcupado] = useState<"" | "resumo" | "duvida">("");
  const [erro, setErro] = useState("");

  const resumir = async () => {
    setOcupado("resumo"); setErro("");
    try { setResumo((await cursosApi.post<{ resumo: string }>(`/aula/${aulaId}/resumo`)).resumo); }
    catch (e) { setErro(errorMessage(e)); } finally { setOcupado(""); }
  };
  const perguntar = async () => {
    const texto = pergunta.trim();
    if (texto.length < 3 || ocupado) return;
    const historico = msgs;
    setMsgs([...historico, { role: "user", content: texto }]); setPergunta(""); setOcupado("duvida"); setErro("");
    try {
      const r = await cursosApi.post<{ resposta: string }>(`/aula/${aulaId}/duvida`, { pergunta: texto, historico });
      setMsgs((m) => [...m, { role: "assistant", content: r.resposta }]);
    } catch (e) { setErro(errorMessage(e)); } finally { setOcupado(""); }
  };

  return (
    <section className="aula-tutor">
      <button type="button" className="btn btn--outline btn--sm" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}><Sparkles size={15} /> Ajuda da IA</button>
      {aberto && (
        <div className="tutor-caixa">
          <p className="tutor-aviso">A IA responde só com o conteúdo desta aula. Confira o material antes de decidir algo importante.</p>
          <div className="tutor-acoes">
            <button type="button" className="btn btn--soft btn--sm" disabled={!!ocupado} onClick={resumir}><ListChecks size={14} /> {ocupado === "resumo" ? "Resumindo…" : "Resumir a aula"}</button>
          </div>
          {resumo && <div className="tutor-resumo" role="region" aria-label="Resumo da aula">{resumo}</div>}
          <div className="tutor-conversa" aria-live="polite">
            {msgs.map((m, i) => <div key={i} className={`tutor-msg ${m.role}`}>{m.role === "assistant" && <Bot size={14} aria-hidden="true" />}<span>{m.content}</span></div>)}
            {ocupado === "duvida" && <div className="tutor-msg assistant"><Bot size={14} aria-hidden="true" /><span>Pensando…</span></div>}
          </div>
          <form className="tutor-form" onSubmit={(e) => { e.preventDefault(); void perguntar(); }}>
            <input value={pergunta} maxLength={600} placeholder="Tem alguma dúvida sobre esta aula?" aria-label="Sua dúvida sobre a aula" onChange={(e) => setPergunta(e.target.value)} />
            <button type="submit" className="btn btn--primary btn--sm" disabled={!!ocupado || pergunta.trim().length < 3} aria-label="Enviar dúvida"><Send size={14} /></button>
          </form>
          {erro && <p className="erro-inline" role="alert">{erro}</p>}
        </div>
      )}
    </section>
  );
}
