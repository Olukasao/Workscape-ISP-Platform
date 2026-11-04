import { useState } from "react";
import { Sparkles, LoaderCircle, MessageSquareWarning } from "lucide-react";
import { Button } from "../components/ui/button";
import { PageHeader, EmptyState } from "../components/ui/primitives";
import { localAiCompletar, localAiDisponivel, descreverStatusLocalAi, onLocalAiStatus } from "../services/localAi";

// Ferramenta avulsa: cola um erro/log técnico e a IA local explica em linguagem simples.
// Roda só neste computador; nada do texto sai dele.
export default function ExplicarErroIa() {
  const [texto, setTexto] = useState("");
  const [explicacao, setExplicacao] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [status, setStatus] = useState("");

  if (!localAiDisponivel())
    return (
      <div className="page">
        <EmptyState icon={MessageSquareWarning} title="IA local indisponível">
          Esse recurso só existe no aplicativo Windows, em computadores com RAM suficiente.
        </EmptyState>
      </div>
    );

  const explicar = async () => {
    setErro(""); setExplicacao(""); setCarregando(true);
    const parar = onLocalAiStatus((s) => setStatus(descreverStatusLocalAi(s)));
    try {
      const resposta = await localAiCompletar("explicar-erro", texto);
      setExplicacao(resposta);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível explicar agora.");
    } finally {
      setCarregando(false);
      setStatus("");
      parar();
    }
  };

  return (
    <div className="page">
      <PageHeader
        icon={MessageSquareWarning}
        title="Explicar erro (IA)"
        description="Cole uma mensagem de erro, um trecho de log ou um código técnico. A IA local explica o que pode ter acontecido e o que checar primeiro."
      />
      <section className="panel" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <textarea
          rows={8}
          maxLength={20000}
          placeholder="Cole aqui o erro ou o log..."
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          disabled={carregando}
        />
        <Button type="button" disabled={!texto.trim() || carregando} onClick={() => void explicar()}>
          {carregando ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {carregando ? (status || "Pensando...") : "Explicar"}
        </Button>
        {erro && <p role="alert" className="form-error">{erro}</p>}
        {explicacao && (
          <div className="panel" style={{ whiteSpace: "pre-wrap", background: "var(--bg-secondary)" }}>
            {explicacao}
          </div>
        )}
      </section>
    </div>
  );
}
