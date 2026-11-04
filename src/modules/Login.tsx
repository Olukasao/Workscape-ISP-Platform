import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, MotionConfig, motion, useAnimationControls, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, CircleAlert, Eye, EyeOff, LoaderCircle, Settings2 } from "lucide-react";
import logo from "../assets/brand/logo-acessanet.png";
import { api, errorMessage } from "../services/api";
import DiagnosticoConexao from "../components/DiagnosticoConexao";
import { useServers, useSession } from "../stores/workspace";
import { FiberField } from "./login/fiberField";

// Último acesso neste computador: só o e-mail e o primeiro nome, para cumprimentar e preencher o campo.
const ULTIMO = "workspace:ultimo-acesso";
const lerUltimo = (): { email: string; nome: string } | null => {
  try {
    const v = JSON.parse(localStorage.getItem(ULTIMO) || "null");
    return typeof v?.email === "string" ? { email: v.email, nome: String(v.nome || "") } : null;
  } catch { return null; }
};
const saudacao = () => {
  const h = new Date().getHours();
  return h < 5 ? "Boa noite" : h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
};
const sessaoExpirou = () => {
  try {
    const v = sessionStorage.getItem("workspace:sessao-expirou") === "1";
    sessionStorage.removeItem("workspace:sessao-expirou");
    return v;
  } catch { return false; }
};

type Fase = "pronto" | "entrando" | "liberado";
const suave = [0.22, 1, 0.36, 1] as const;

export default function Login() {
  const navigate = useNavigate(),
    config = useServers((s) => s.config),
    { setSession, setEntrando } = useSession();
  const ultimo = useRef(lerUltimo()).current;
  const [email, setEmail] = useState(ultimo?.email || ""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [expirou] = useState(sessaoExpirou),
    [fase, setFase] = useState<Fase>("pronto"),
    [reveal, setReveal] = useState(false),
    [caps, setCaps] = useState(false);
  const reduzido = !!useReducedMotion();
  const canvas = useRef<HTMLCanvasElement>(null);
  const painel = useRef<HTMLDivElement>(null);
  const senhaRef = useRef<HTMLInputElement>(null);
  const fibras = useRef<FiberField | null>(null);
  const tremor = useAnimationControls();

  useEffect(() => {
    if (!canvas.current) return;
    const f = new FiberField(canvas.current, () => painel.current?.getBoundingClientRect() || null, reduzido);
    fibras.current = f;
    return () => { f.destruir(); fibras.current = null; };
  }, [reduzido]);
  useEffect(() => { if (ultimo?.email) senhaRef.current?.focus(); }, [ultimo]);

  const ocupado = fase !== "pronto";
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (ocupado) return;
    setError("");
    setFase("entrando");
    // Mantém esta tela aberta até a animação de acesso terminar.
    setEntrando(true);
    try {
      const { data } = await api.post("/login", { email, senha: password });
      if (typeof data.token !== "string" || !data.user?.id)
        throw new Error("Resposta de autenticação inválida.");
      setSession(data.token, data.user);
      const { data: user } = await api.get("/me");
      setSession(data.token, user);
      // No desktop, a sessão é sempre protegida pelo armazenamento seguro do Windows.
      // O instalador preserva esse arquivo durante a atualização.
      if (window.desktop) await window.desktop.saveSession({ token: data.token });
      try {
        localStorage.setItem(ULTIMO, JSON.stringify({ email: email.trim().toLowerCase(), nome: String(user?.nome || "").split(" ")[0] }));
        sessionStorage.setItem("workspace:chegada", "1");
      } catch { /* Sem armazenamento. */ }
      setPassword("");
      setFase("liberado");
      fibras.current?.acesso();
      await new Promise((r) => setTimeout(r, reduzido ? 250 : 1100));
      navigate("/");
      setEntrando(false);
    } catch (err) {
      useSession.getState().clear();
      setEntrando(false);
      setFase("pronto");
      setError(errorMessage(err));
      fibras.current?.erro();
      if (!reduzido) void tremor.start({ x: [0, -9, 8, -5, 3, 0], transition: { duration: 0.42, ease: "easeOut" } });
      senhaRef.current?.select();
    }
  }

  const tecla = (ev: React.KeyboardEvent<HTMLInputElement>) => {
    setCaps(ev.getModifierState?.("CapsLock") ?? false);
    if (ev.key.length === 1 || ev.key === "Backspace") fibras.current?.tecla();
  };

  const nome = ultimo?.nome;
  const entrada = (atraso: number) => ({
    initial: { opacity: 0, y: 14, filter: "blur(6px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    transition: { duration: 0.7, delay: atraso, ease: suave },
  });

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        className={`acesso ${fase === "liberado" ? "is-liberado" : ""}`}
        animate={fase === "liberado" && !reduzido ? { opacity: [1, 1, 0], scale: [1, 1, 1.02] } : { opacity: 1, scale: 1 }}
        transition={fase === "liberado" ? { duration: 1.1, times: [0, 0.6, 1], ease: "easeIn" } : { duration: 0 }}
      >
        <div className="acesso-ceu" aria-hidden="true" />
        <motion.canvas
          ref={canvas}
          className="acesso-fibras"
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.6, delay: 0.35, ease: "easeOut" }}
        />

        <header className="acesso-marca">
          <motion.img
            src={logo}
            alt="AcessaNet"
            width={877}
            height={327}
            initial={{ opacity: 0, scale: 0.96, filter: "blur(10px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.9, ease: suave }}
          />
          <motion.span className="acesso-produto" {...entrada(0.25)}>Workspace</motion.span>
        </header>

        <section className="acesso-texto" aria-label="Boas-vindas">
          <motion.h1 {...entrada(0.45)}>
            {saudacao()}{nome ? `, ${nome}` : ""}.
          </motion.h1>
          <motion.p {...entrada(0.58)}>
            Chat Interno, agenda de campo e Painel NOC da AcessaNet, num só aplicativo e com uma única senha.
          </motion.p>
        </section>

        <motion.div
          ref={painel}
          className="acesso-painel"
          initial={{ opacity: 0, y: 22, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.55, ease: suave }}
        >
          <motion.form onSubmit={submit} animate={tremor} noValidate={false}>
            <motion.div className="acesso-cabeca" {...entrada(0.75)}>
              <h2>Entrar</h2>
              <p>Use o e-mail e a senha do Chat Interno.</p>
            </motion.div>

            <AnimatePresence initial={false}>
              {!config.chat ? (
                <motion.p key="sem-servidor" className="acesso-aviso" role="status" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                  <CircleAlert size={15} /> Configure o servidor em “Configurar conexão” para entrar.
                </motion.p>
              ) : expirou && !error ? (
                <motion.p key="expirou" className="acesso-aviso" role="status" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                  <CircleAlert size={15} /> Sua sessão expirou. Entre de novo para continuar.
                </motion.p>
              ) : null}
            </AnimatePresence>

            <motion.label className="acesso-campo" {...entrada(0.85)}>
              <span>E-mail corporativo</span>
              <input
                type="email"
                autoComplete="username"
                required
                spellCheck={false}
                value={email}
                disabled={ocupado}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={tecla}
                placeholder="voce@acessanet.com.br"
              />
              <i aria-hidden="true" />
            </motion.label>

            <motion.label className="acesso-campo" {...entrada(0.93)}>
              <span>
                Senha
                <AnimatePresence>
                  {caps ? (
                    <motion.small key="caps" className="acesso-caps" initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                      Caps Lock ligado
                    </motion.small>
                  ) : null}
                </AnimatePresence>
              </span>
              <span className="acesso-senha">
                <input
                  ref={senhaRef}
                  type={reveal ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  disabled={ocupado}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={tecla}
                  onKeyUp={(e) => setCaps(e.getModifierState?.("CapsLock") ?? false)}
                  placeholder="Sua senha"
                />
                <button
                  type="button"
                  className="acesso-olho"
                  aria-label={reveal ? "Ocultar senha" : "Mostrar senha"}
                  aria-pressed={reveal}
                  onClick={() => setReveal((v) => !v)}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span key={reveal ? "o" : "f"} initial={{ opacity: 0, rotate: -20 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0, rotate: 20 }} transition={{ duration: 0.16 }}>
                      {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
                    </motion.span>
                  </AnimatePresence>
                </button>
              </span>
              <i aria-hidden="true" />
            </motion.label>

            <motion.div className="acesso-lembrar" {...entrada(1.0)}>
              <span className="acesso-chave is-ativo" aria-hidden="true" />
              <span>
                Sessão mantida neste computador
                <small>Continua conectada após atualizações, com a proteção do Windows.</small>
              </span>
            </motion.div>

            <AnimatePresence>
              {error ? (
                <motion.p
                  key={error}
                  className="acesso-erro"
                  role="alert"
                  initial={{ opacity: 0, y: -4, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <CircleAlert size={15} /> {error}
                </motion.p>
              ) : null}
            </AnimatePresence>

            {error && window.desktop?.testarConexao ? (
              <details className="acesso-diag">
                <summary>Está fora do escritório? Testar a conexão</summary>
                <DiagnosticoConexao />
              </details>
            ) : null}

            <motion.div {...entrada(1.08)}>
              <motion.button
                type="submit"
                className={`acesso-entrar is-${fase}`}
                disabled={ocupado || !config.chat}
                whileTap={ocupado ? undefined : { scale: 0.985 }}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={fase}
                    className="acesso-entrar-rotulo"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18 }}
                  >
                    {fase === "pronto" ? <>Entrar no Workspace <ArrowRight size={17} /></> : null}
                    {fase === "entrando" ? <><LoaderCircle size={17} className="animate-spin" /> Verificando acesso…</> : null}
                    {fase === "liberado" ? <><Check size={18} strokeWidth={2.6} /> Acesso liberado</> : null}
                  </motion.span>
                </AnimatePresence>
              </motion.button>
            </motion.div>

            <motion.button type="button" className="acesso-config" onClick={() => navigate("/settings")} disabled={ocupado} {...entrada(1.15)}>
              <Settings2 size={15} /> Configurar conexão
            </motion.button>
          </motion.form>
        </motion.div>

        <motion.footer className="acesso-rodape" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3, duration: 0.8 }}>
          AcessaNet | Plataforma Interna
        </motion.footer>
      </motion.div>
    </MotionConfig>
  );
}
