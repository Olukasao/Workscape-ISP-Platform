import { useRef, useState, type FormEvent } from "react";
import { LogOut, ShieldCheck, Building2, Briefcase, KeyRound, Mail, Camera, Trash2, Lock } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "../stores/workspace";
import { signOut } from "../services/session";
import { errorMessage } from "../services/api";
import { atualizarPerfil, prepararFoto } from "../services/profile";
import { Button } from "../components/ui/button";
import { Avatar, Badge, PageHeader } from "../components/ui/primitives";

export default function Profile() {
  const user = useSession((s) => s.user),
    query = useQueryClient();
  const arquivo = useRef<HTMLInputElement>(null);
  const [foto, setFoto] = useState<{ ocupado: boolean; ok: string; erro: string }>({ ocupado: false, ok: "", erro: "" });
  const [emailNovo, setEmailNovo] = useState("");
  const [emailSenha, setEmailSenha] = useState("");
  const [emailEstado, setEmailEstado] = useState<{ ocupado: boolean; ok: string; erro: string }>({ ocupado: false, ok: "", erro: "" });
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [senha, setSenha] = useState<{ ocupado: boolean; ok: string; erro: string }>({ ocupado: false, ok: "", erro: "" });

  const trocarFoto = async (file?: File | null) => {
    if (!file) return;
    setFoto({ ocupado: true, ok: "", erro: "" });
    try {
      await atualizarPerfil({ avatar: await prepararFoto(file) });
      setFoto({ ocupado: false, ok: "Foto atualizada.", erro: "" });
    } catch (e) {
      setFoto({ ocupado: false, ok: "", erro: errorMessage(e) });
    } finally {
      if (arquivo.current) arquivo.current.value = "";
    }
  };
  const removerFoto = async () => {
    setFoto({ ocupado: true, ok: "", erro: "" });
    try {
      await atualizarPerfil({ avatar: "" });
      setFoto({ ocupado: false, ok: "Foto removida.", erro: "" });
    } catch (e) {
      setFoto({ ocupado: false, ok: "", erro: errorMessage(e) });
    }
  };
  const trocarEmail = async (event: FormEvent) => {
    event.preventDefault();
    const novo = emailNovo.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(novo)) return setEmailEstado({ ocupado: false, ok: "", erro: "Informe um e-mail válido." });
    if (novo === (user?.email || "").trim().toLowerCase()) return setEmailEstado({ ocupado: false, ok: "", erro: "Este já é o seu e-mail." });
    setEmailEstado({ ocupado: true, ok: "", erro: "" });
    try {
      await atualizarPerfil({ email: novo, senha_atual: emailSenha });
      setEmailNovo("");
      setEmailSenha("");
      setEmailEstado({ ocupado: false, ok: "E-mail alterado. Use o novo e-mail no próximo acesso.", erro: "" });
    } catch (e) {
      setEmailEstado({ ocupado: false, ok: "", erro: errorMessage(e) });
    }
  };
  const trocarSenha = async (event: FormEvent) => {
    event.preventDefault();
    if (nova.length < 6) return setSenha({ ocupado: false, ok: "", erro: "A nova senha precisa ter pelo menos 6 caracteres." });
    if (nova !== confirmar) return setSenha({ ocupado: false, ok: "", erro: "A confirmação não é igual à nova senha." });
    if (nova === atual) return setSenha({ ocupado: false, ok: "", erro: "A nova senha precisa ser diferente da atual." });
    setSenha({ ocupado: true, ok: "", erro: "" });
    try {
      await atualizarPerfil({ senha_atual: atual, nova_senha: nova });
      setAtual("");
      setNova("");
      setConfirmar("");
      setSenha({ ocupado: false, ok: "Senha alterada. Use a nova senha no próximo acesso.", erro: "" });
    } catch (e) {
      setSenha({ ocupado: false, ok: "", erro: errorMessage(e) });
    }
  };
  return (
    <div className="page narrow-page">
      <PageHeader
        title="Perfil"
        description="Identidade compartilhada entre os módulos do workspace."
      />
      <section className="panel profile-card">
        <div className="profile-hero">
          <Avatar name={user?.nome} src={user?.avatar} brand size="xl" />
          <div>
            <h2>{user?.nome}</h2>
            <p>
              <Mail size={14} />
              {user?.email}
            </p>
            {user?.perfil ? (
              <Badge tone={user.perfil === "admin" ? "info" : "neutral"}>
                {user.perfil}
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="profile-photo-actions">
          <input
            ref={arquivo}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            hidden
            aria-label="Escolher foto de perfil"
            onChange={(e) => void trocarFoto(e.target.files?.[0])}
          />
          <Button variant="outline" size="sm" disabled={foto.ocupado} onClick={() => arquivo.current?.click()}>
            <Camera size={14} /> {foto.ocupado ? "Enviando…" : "Trocar foto"}
          </Button>
          {user?.avatar ? (
            <Button variant="ghost" size="sm" disabled={foto.ocupado} onClick={() => void removerFoto()}>
              <Trash2 size={14} /> Remover foto
            </Button>
          ) : null}
          {foto.ok ? <span role="status" className="muted text-xs">{foto.ok}</span> : null}
          {foto.erro ? <span role="alert" className="inline-error">{foto.erro}</span> : null}
        </div>
        <dl className="profile-details">
          {(
            [
              [Building2, "Empresa", user?.empresa_nome],
              [Briefcase, "Setor", user?.setor_nome],
              [KeyRound, "Perfil", user?.perfil],
            ] as const
          ).map(([Icon, label, value]) => (
            <div key={label}>
              <dt>
                <Icon size={14} />
                {label}
              </dt>
              <dd>{value || "Não informado"}</dd>
            </div>
          ))}
        </dl>
        <p className="subtle-note">
          <ShieldCheck size={16} />
          Informações verificadas pelo endpoint /me do Chat Interno.
        </p>
      </section>
      <section className="panel password-card" aria-labelledby="email-titulo">
        <div>
          <h2 id="email-titulo">Alterar e-mail</h2>
          <p>O e-mail é o seu login no Chat Interno e no Workspace. Atual: <strong>{user?.email}</strong></p>
        </div>
        <form className="password-form" onSubmit={(e) => void trocarEmail(e)}>
          <label className="field"><span>Novo e-mail</span>
            <input type="email" autoComplete="email" required value={emailNovo} onChange={(e) => setEmailNovo(e.target.value)} />
          </label>
          <label className="field"><span>Senha atual (para confirmar)</span>
            <input type="password" autoComplete="current-password" required value={emailSenha} onChange={(e) => setEmailSenha(e.target.value)} />
          </label>
          {emailEstado.erro ? <p role="alert" className="inline-error">{emailEstado.erro}</p> : null}
          {emailEstado.ok ? <p role="status" className="muted">{emailEstado.ok}</p> : null}
          <Button type="submit" disabled={emailEstado.ocupado || !emailNovo || !emailSenha}>
            <Mail size={15} /> {emailEstado.ocupado ? "Salvando…" : "Alterar e-mail"}
          </Button>
        </form>
      </section>
      <section className="panel password-card" aria-labelledby="senha-titulo">
        <div>
          <h2 id="senha-titulo">Alterar senha</h2>
          <p>A mesma senha do Chat Interno. Mínimo de 6 caracteres.</p>
        </div>
        <form className="password-form" onSubmit={(e) => void trocarSenha(e)}>
          <label className="field"><span>Senha atual</span>
            <input type="password" autoComplete="current-password" required value={atual} onChange={(e) => setAtual(e.target.value)} />
          </label>
          <label className="field"><span>Nova senha</span>
            <input type="password" autoComplete="new-password" required minLength={6} value={nova} onChange={(e) => setNova(e.target.value)} />
          </label>
          <label className="field"><span>Confirmar nova senha</span>
            <input type="password" autoComplete="new-password" required minLength={6} value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />
          </label>
          {senha.erro ? <p role="alert" className="inline-error">{senha.erro}</p> : null}
          {senha.ok ? <p role="status" className="muted">{senha.ok}</p> : null}
          <Button type="submit" disabled={senha.ocupado || !atual || !nova || !confirmar}>
            <Lock size={15} /> {senha.ocupado ? "Salvando…" : "Alterar senha"}
          </Button>
        </form>
      </section>
      <section className="panel session-card">
        <div>
          <h2>Sessão neste dispositivo</h2>
          <p>
            Sair encerra a sessão local e remove o acesso lembrado deste
            computador.
          </p>
        </div>
        <Button variant="danger" onClick={() => signOut(query)}>
          <LogOut size={16} />
          Sair do Workspace
        </Button>
      </section>
    </div>
  );
}
