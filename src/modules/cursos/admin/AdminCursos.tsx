import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Archive, ArrowDown, ArrowUp, Copy, Eye, EyeOff, FolderPlus, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Badge, EmptyState, Panel, Skeleton } from "../../../components/ui/primitives";
import { cursosApi, errorMessage, formatarData, useCursosMutation, useCursosQuery } from "../api";
import { useConfirmar, type DadosBase } from "./comum";

interface Linha { id: number; titulo: string; status: string; nivel: string; obrigatorio: number; atualizado_em: string; categoria: string | null; aulas: number; matriculas: number; concluidos: number }
const ROTULO: Record<string, string> = { rascunho: "Rascunho", publicado: "Publicado", arquivado: "Arquivado" };
const TOM: Record<string, "warn" | "ok" | "neutral"> = { rascunho: "warn", publicado: "ok", arquivado: "neutral" };

function Categorias() {
  const base = useCursosQuery<DadosBase>(["admin", "base"], "/admin/dados-base");
  const [nova, setNova] = useState("");
  const [editando, setEditando] = useState<{ id: number; nome: string } | null>(null);
  const [erro, setErro] = useState("");
  const { pedir, dialogo } = useConfirmar();
  const falha = (e: unknown) => setErro(errorMessage(e));
  const inv = [["cursos", "admin"], ["cursos", "categorias"]];
  const criar = useCursosMutation((nome: string) => cursosApi.post("/admin/categorias", { nome }), inv, () => { setNova(""); setErro(""); });
  const renomear = useCursosMutation((v: { id: number; nome: string }) => cursosApi.put(`/admin/categorias/${v.id}`, { nome: v.nome }), inv, () => { setEditando(null); setErro(""); });
  const excluir = useCursosMutation((id: number) => cursosApi.del(`/admin/categorias/${id}`), inv);
  const ordenar = useCursosMutation((ids: number[]) => cursosApi.put("/admin/categorias-ordem", { ids }), inv);
  const cats = base.data?.categorias ?? [];
  const mover = (i: number, d: number) => { const ids = cats.map((c) => c.id); [ids[i], ids[i + d]] = [ids[i + d], ids[i]]; ordenar.mutate(ids); };
  return (
    <Panel title="Categorias" icon={FolderPlus}>
      <ul className="admin-categorias">
        {cats.map((c, i) => (
          <li key={c.id}>
            {editando?.id === c.id ? (
              <form onSubmit={(e) => { e.preventDefault(); renomear.mutate(editando, { onError: falha }); }}>
                <input autoFocus value={editando.nome} onChange={(e) => setEditando({ id: c.id, nome: e.target.value })} aria-label="Nome da categoria" />
                <button className="btn btn--primary btn--sm" type="submit">Salvar</button>
                <button className="btn btn--ghost btn--sm" type="button" onClick={() => setEditando(null)}>Cancelar</button>
              </form>
            ) : (
              <>
                <span>{c.nome}</span>
                <button className="btn btn--ghost btn--icon-sm" aria-label="Subir" disabled={i === 0} onClick={() => mover(i, -1)}><ArrowUp size={14} /></button>
                <button className="btn btn--ghost btn--icon-sm" aria-label="Descer" disabled={i === cats.length - 1} onClick={() => mover(i, 1)}><ArrowDown size={14} /></button>
                <button className="btn btn--ghost btn--icon-sm" aria-label="Renomear" onClick={() => setEditando({ id: c.id, nome: c.nome })}><Pencil size={14} /></button>
                <button className="btn btn--ghost btn--icon-sm" aria-label="Excluir" onClick={() => pedir("Excluir categoria", `Os cursos de “${c.nome}” continuam existindo, mas ficam sem categoria.`, () => excluir.mutate(c.id))}><Trash2 size={14} /></button>
              </>
            )}
          </li>
        ))}
      </ul>
      <form className="admin-nova-cat" onSubmit={(e) => { e.preventDefault(); if (nova.trim()) criar.mutate(nova, { onError: falha }); }}>
        <input value={nova} onChange={(e) => setNova(e.target.value)} placeholder="Nova categoria" aria-label="Nova categoria" maxLength={120} />
        <button className="btn btn--outline btn--sm" type="submit"><Plus size={14} /> Adicionar</button>
      </form>
      {erro && <p className="erro-inline" role="alert">{erro}</p>}
      {dialogo}
    </Panel>
  );
}

export default function AdminCursos() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [erro, setErro] = useState("");
  const params = { status: status || undefined, q: q || undefined };
  const { data, isLoading } = useCursosQuery<{ cursos: Linha[] }>(["admin", "cursos", params], "/admin/cursos", params);
  const { pedir, dialogo } = useConfirmar();
  const inv = [["cursos", "admin"], ["cursos", "catalogo"], ["cursos", "painel"]];
  const criar = useCursosMutation(() => cursosApi.post<{ id: number }>("/admin/cursos", { titulo: "Novo curso" }), inv, (r) => navigate(`/cursos/admin/curso/${r.id}`));
  const situacao = useCursosMutation((v: { id: number; status: string }) => cursosApi.put(`/admin/cursos/${v.id}/status`, { status: v.status }), inv);
  const duplicar = useCursosMutation((id: number) => cursosApi.post<{ id: number }>(`/admin/cursos/${id}/duplicar`), inv);
  const excluir = useCursosMutation((v: { id: number; forcar: boolean }) => cursosApi.del(`/admin/cursos/${v.id}`, v.forcar ? { forcar: 1 } : undefined), inv);
  const falha = (e: unknown) => setErro(errorMessage(e));
  return (
    <div className="admin-cursos">
      <header className="cursos-titulo linha"><div><h1>Gerenciar cursos</h1><p>Crie, edite, publique e acompanhe os treinamentos.</p></div>
        <button type="button" className="btn btn--primary" onClick={() => criar.mutate(undefined, { onError: falha })}><Plus size={16} /> Novo curso</button></header>
      <div className="catalogo-filtros">
        <label className="busca"><Search size={16} /><input type="search" placeholder="Buscar curso" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <select aria-label="Situação" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Ativos (exceto arquivados)</option><option value="rascunho">Rascunhos</option><option value="publicado">Publicados</option><option value="arquivado">Arquivados</option></select>
      </div>
      {erro && <p className="erro-inline" role="alert">{erro}</p>}
      {isLoading ? <Skeleton lines={5} /> : data?.cursos.length ? (
        <div className="tabela-admin" role="table">
          <div className="tr cab" role="row"><span>Curso</span><span>Situação</span><span>Aulas</span><span>Alunos</span><span>Concluídos</span><span>Atualizado</span><span /></div>
          {data.cursos.map((c) => (
            <div key={c.id} className="tr" role="row">
              <span><Link to={`/cursos/admin/curso/${c.id}`}><strong>{c.titulo}</strong></Link><small>{c.categoria ?? "Sem categoria"}{c.obrigatorio ? " · obrigatório" : ""}</small></span>
              <span><Badge tone={TOM[c.status]}>{ROTULO[c.status]}</Badge></span>
              <span>{c.aulas}</span><span>{c.matriculas}</span><span>{c.concluidos}</span><span>{formatarData(c.atualizado_em)}</span>
              <span className="acoes">
                <Link className="btn btn--ghost btn--icon-sm" to={`/cursos/curso/${c.id}`} aria-label="Pré-visualizar" title="Ver como aluno"><Eye size={15} /></Link>
                <Link className="btn btn--ghost btn--icon-sm" to={`/cursos/admin/curso/${c.id}`} aria-label="Editar" title="Editar"><Pencil size={15} /></Link>
                {c.status === "publicado"
                  ? <button className="btn btn--ghost btn--icon-sm" aria-label="Despublicar" title="Despublicar" onClick={() => situacao.mutate({ id: c.id, status: "rascunho" }, { onError: falha })}><EyeOff size={15} /></button>
                  : c.status === "rascunho" ? <button className="btn btn--soft btn--sm" onClick={() => situacao.mutate({ id: c.id, status: "publicado" }, { onError: falha })}>Publicar</button>
                    : <button className="btn btn--soft btn--sm" onClick={() => situacao.mutate({ id: c.id, status: "rascunho" }, { onError: falha })}>Reativar</button>}
                <button className="btn btn--ghost btn--icon-sm" aria-label="Duplicar" title="Duplicar" onClick={() => duplicar.mutate(c.id, { onError: falha })}><Copy size={15} /></button>
                {c.status !== "arquivado" && <button className="btn btn--ghost btn--icon-sm" aria-label="Arquivar" title="Arquivar" onClick={() => pedir("Arquivar curso", `“${c.titulo}” sai do catálogo, mas o histórico e os certificados dos alunos são mantidos.`, () => situacao.mutate({ id: c.id, status: "arquivado" }, { onError: falha }), "Arquivar")}><Archive size={15} /></button>}
                <button className="btn btn--ghost btn--icon-sm" aria-label="Excluir" title="Excluir" onClick={() => pedir("Excluir curso", c.matriculas ? `“${c.titulo}” tem ${c.matriculas} matrícula(s). Excluir apaga também o progresso e as notas dessas pessoas. Isso não pode ser desfeito.` : `Excluir “${c.titulo}” definitivamente? Isso não pode ser desfeito.`, () => excluir.mutate({ id: c.id, forcar: c.matriculas > 0 }, { onError: falha }))}><Trash2 size={15} /></button>
              </span>
            </div>
          ))}
        </div>
      ) : <EmptyState icon={FolderPlus} title="Nenhum curso por aqui">Clique em “Novo curso” para começar.</EmptyState>}
      <Categorias />
      {dialogo}
    </div>
  );
}
