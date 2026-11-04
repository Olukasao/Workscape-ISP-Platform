import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowDown, ArrowUp, Download, FileDown, Plus, Route, Trash2 } from "lucide-react";
import { Badge, EmptyState, Panel, Skeleton } from "../../../components/ui/primitives";
import { cursosApi, errorMessage, formatarData, useCursosMutation, useCursosQuery } from "../api";
import { Campo, mover, useConfirmar, type DadosBase } from "./comum";

// ---------- Funcionários ----------
export function AlunosAdmin() {
  const [q, setQ] = useState(""); const [setor, setSetor] = useState(0);
  const base = useCursosQuery<DadosBase>(["admin", "base"], "/admin/dados-base", undefined, { staleTime: 60000 });
  const params = { q: q || undefined, setor: setor || undefined };
  const { data, isLoading } = useCursosQuery<{ alunos: { id: number; nome: string; setor: string | null; matriculas: number; concluidos: number; obrigatorios_pendentes: number; atrasados: number; horas: number }[] }>(["admin", "alunos", params], "/admin/alunos", params);
  return (
    <div>
      <header className="cursos-titulo"><h1>Funcionários</h1><p>Progresso e pendências de cada pessoa.</p></header>
      <div className="catalogo-filtros">
        <label className="busca"><input type="search" placeholder="Buscar funcionário" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <select aria-label="Setor" value={setor} onChange={(e) => setSetor(Number(e.target.value))}><option value={0}>Todos os setores</option>{base.data?.setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</select>
      </div>
      {isLoading ? <Skeleton lines={5} /> : (
        <div className="tabela-admin" role="table">
          <div className="tr cab" role="row"><span>Funcionário</span><span>Matrículas</span><span>Concluídos</span><span>Obrig. pendentes</span><span>Atrasados</span><span>Horas</span></div>
          {data?.alunos.map((a) => (
            <div className="tr" role="row" key={a.id}>
              <span><Link to={`/cursos/admin/aluno/${a.id}`}><strong>{a.nome}</strong></Link><small>{a.setor ?? "Sem setor"}</small></span>
              <span>{a.matriculas}</span><span>{a.concluidos}</span><span>{a.obrigatorios_pendentes ? <Badge tone="warn">{a.obrigatorios_pendentes}</Badge> : 0}</span><span>{a.atrasados ? <Badge tone="crit">{a.atrasados}</Badge> : 0}</span><span>{a.horas} h</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AlunoDetalhe() {
  const { id } = useParams();
  const { data, isLoading } = useCursosQuery<any>(["admin", "aluno", id], `/admin/alunos/${id}`);
  if (isLoading || !data) return <Skeleton lines={5} />;
  return (
    <div>
      <Link to="/cursos/admin/alunos" className="voltar">← Funcionários</Link>
      <header className="cursos-titulo"><h1>{data.aluno.nome}</h1><p>{data.aluno.setor ?? "Sem setor"} · {data.estatisticas.pontos} pontos · {data.estatisticas.certificados} certificados</p></header>
      <Panel title="Cursos">
        <div className="tabela-admin" role="table"><div className="tr cab" role="row"><span>Curso</span><span>Progresso</span><span>Prazo</span><span>Situação</span></div>
          {data.cursos.map((c: any) => <div className="tr" role="row" key={c.curso_id}><span><strong>{c.titulo}</strong>{c.obrigatorio ? <small>obrigatório</small> : null}</span><span>{c.progresso}%</span><span>{c.prazo_em ? formatarData(c.prazo_em) : "—"}</span>
            <span>{c.concluido_em ? <Badge tone="ok">Concluído</Badge> : c.prazo_em && new Date(c.prazo_em) < new Date() ? <Badge tone="crit">Atrasado</Badge> : <Badge tone="info">Em andamento</Badge>}</span></div>)}
          {!data.cursos.length && <p className="mudo">Sem matrículas.</p>}
        </div>
      </Panel>
      <Panel title="Provas e tentativas">
        <div className="tabela-admin" role="table"><div className="tr cab" role="row"><span>Avaliação</span><span>Tentativa</span><span>Nota</span><span>Resultado</span></div>
          {data.tentativas.map((t: any) => <div className="tr" role="row" key={t.id}><span><strong>{t.prova}</strong><small>{t.curso}</small></span><span>{t.numero}</span><span>{t.nota ?? "—"}</span>
            <span>{t.status === "aguardando_correcao" ? <Badge tone="warn">Aguardando correção</Badge> : t.status === "em_andamento" ? <Badge tone="info">Em andamento</Badge> : <Badge tone={t.aprovado ? "ok" : "crit"}>{t.aprovado ? "Aprovado" : "Reprovado"}</Badge>}</span></div>)}
          {!data.tentativas.length && <p className="mudo">Nenhuma tentativa.</p>}
        </div>
      </Panel>
      <Panel title="Certificados">{data.certificados.length ? <ul className="historico">{data.certificados.map((c: any) => <li key={c.codigo}>{c.curso_titulo}<small>{c.codigo} · {formatarData(c.emitido_em)}</small></li>)}</ul> : <p className="mudo">Nenhum certificado.</p>}</Panel>
    </div>
  );
}

// ---------- Correção manual ----------
export function Correcoes() {
  const navigate = useNavigate();
  const { data, isLoading } = useCursosQuery<{ correcoes: { id: number; numero: number; finalizada_em: string; aluno: string; prova: string; curso: string }[] }>(["admin", "correcoes"], "/admin/correcoes", undefined, { staleTime: 0 });
  return (
    <div>
      <header className="cursos-titulo"><h1>Correções pendentes</h1><p>Respostas discursivas aguardando nota.</p></header>
      {isLoading ? <Skeleton lines={3} /> : data?.correcoes.length ? (
        <ul className="historico">{data.correcoes.map((c) => <li key={c.id}><a href="#" onClick={(e) => { e.preventDefault(); navigate(`/cursos/admin/correcao/${c.id}`); }}>{c.aluno} · {c.prova}</a><small>{c.curso} · tentativa {c.numero} · {formatarData(c.finalizada_em)}</small></li>)}</ul>
      ) : <EmptyState icon={Download} title="Nada para corrigir">Quando um aluno enviar uma resposta discursiva, ela aparece aqui.</EmptyState>}
    </div>
  );
}

export function CorrigirTentativa() {
  const { id } = useParams(); const navigate = useNavigate();
  const { data, isLoading } = useCursosQuery<any>(["admin", "tentativa", id], `/admin/tentativas/${id}`, undefined, { staleTime: 0 });
  const [notas, setNotas] = useState<Record<string, { pontos: string; comentario: string }>>({});
  const [erro, setErro] = useState("");
  const salvar = useCursosMutation(() => {
    const manuais = Object.fromEntries(Object.entries(notas).filter(([, v]) => v.pontos !== "").map(([k, v]) => [k, { pontos: Number(v.pontos), comentario: v.comentario }]));
    return cursosApi.put<{ nota: number | null }>(`/admin/tentativas/${id}/corrigir`, { manuais });
  }, [["cursos", "admin"]], () => navigate("/cursos/admin/correcoes"));
  if (isLoading || !data) return <Skeleton lines={5} />;
  const discursivas = data.questoes.filter((q: any) => q.tipo === "discursiva");
  return (
    <div className="corrigir">
      <Link to="/cursos/admin/correcoes" className="voltar">← Correções</Link>
      <header className="cursos-titulo"><h1>{data.tentativa.aluno}</h1><p>{data.tentativa.prova}</p></header>
      {discursivas.map((q: any) => {
        const atual = notas[q.id] ?? { pontos: data.manuais[q.id]?.pontos?.toString() ?? "", comentario: data.manuais[q.id]?.comentario ?? "" };
        return (
          <Panel key={q.id} title={q.enunciado}>
            {q.criterio && <p className="mudo">Critério: {q.criterio}</p>}
            <blockquote className="resposta-aluno">{data.respostas[q.id] || <em>Sem resposta</em>}</blockquote>
            <div className="form-grade">
              <Campo rotulo={`Nota (0 a ${q.pontos})`}><input type="number" min={0} max={q.pontos} value={atual.pontos} onChange={(e) => setNotas({ ...notas, [q.id]: { ...atual, pontos: e.target.value } })} /></Campo>
              <Campo rotulo="Comentário para o aluno"><input value={atual.comentario} onChange={(e) => setNotas({ ...notas, [q.id]: { ...atual, comentario: e.target.value } })} /></Campo>
            </div>
          </Panel>
        );
      })}
      {erro && <p className="erro-inline" role="alert">{erro}</p>}
      <button type="button" className="btn btn--primary" disabled={salvar.isPending} onClick={() => salvar.mutate(undefined, { onError: (e) => setErro(errorMessage(e)) })}>Salvar correção</button>
    </div>
  );
}

// ---------- Relatórios ----------
interface Relatorio {
  periodo: { de: string; ate: string };
  kpis: { alunos: number; cursosPublicados: number; matriculasAtivas: number; taxaConclusao: number; mediaAvaliacoes: number | null; horasTreinamento: number };
  maisAcessados: { id: number; titulo: string; matriculas: number; concluidos: number }[]; desempenho: { id: number; nome: string; concluidos: number; matriculas: number }[];
  pendentes: { id: number; nome: string; setor: string | null; pendentes: number; atrasados: number }[]; porSetor: { setor: string; matriculas: number; concluidos: number }[]; serie: { d: string; n: number }[];
}
const csvCelula = (v: unknown) => { let s = String(v ?? ""); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return /[";\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

function Barras({ itens }: { itens: { rotulo: string; valor: number; max: number; extra?: string }[] }) {
  return <ul className="barras">{itens.map((i) => <li key={i.rotulo}><span title={i.rotulo}>{i.rotulo}</span><div><i style={{ width: `${i.max ? (i.valor / i.max) * 100 : 0}%` }} /></div><b>{i.extra ?? i.valor}</b></li>)}</ul>;
}
function Serie({ pontos }: { pontos: { d: string; n: number }[] }) {
  if (!pontos.length) return <p className="mudo">Nenhuma conclusão no período.</p>;
  const max = Math.max(...pontos.map((p) => p.n));
  const w = 560, h = 120, passo = w / Math.max(1, pontos.length);
  return (
    <svg viewBox={`0 0 ${w} ${h + 22}`} className="serie" role="img" aria-label="Conclusões por dia">
      {pontos.map((p, i) => <g key={p.d}><rect x={i * passo + 2} y={h - (p.n / max) * h} width={Math.min(36, Math.max(2, passo - 4))} height={(p.n / max) * h} rx="2"><title>{`${p.d}: ${p.n}`}</title></rect></g>)}
      <text x="0" y={h + 16}>{pontos[0].d}</text><text x={w} y={h + 16} textAnchor="end">{pontos[pontos.length - 1].d}</text>
    </svg>
  );
}

export function Relatorios() {
  const hoje = new Date().toISOString().slice(0, 10);
  const [de, setDe] = useState(new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10));
  const [ate, setAte] = useState(hoje);
  const [setor, setSetor] = useState(0); const [curso, setCurso] = useState(0);
  const [erro, setErro] = useState("");
  const base = useCursosQuery<DadosBase>(["admin", "base"], "/admin/dados-base", undefined, { staleTime: 60000 });
  const lista = useCursosQuery<{ cursos: { id: number; titulo: string }[] }>(["admin", "cursos-todos"], "/admin/cursos", { limite: 100 });
  const params = { de, ate, setor: setor || undefined, curso: curso || undefined };
  const { data, isLoading } = useCursosQuery<Relatorio>(["admin", "relatorio", params], "/admin/relatorios", params);
  const exportar = async (tipo: "csv" | "pdf") => {
    setErro("");
    try {
      const r = await cursosApi.get<{ cab: string[]; linhas: unknown[][] }>("/admin/relatorios/linhas", params);
      if (tipo === "csv") {
        const texto = "﻿" + [r.cab, ...r.linhas].map((l) => l.map(csvCelula).join(";")).join("\r\n");
        const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([texto], { type: "text/csv;charset=utf-8" })); a.download = `relatorio-cursos-${hoje}.csv`; document.body.appendChild(a); a.click(); a.remove();
      } else {
        const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
        const w = window.open("", "_blank");
        if (!w) { setErro("O navegador bloqueou a janela de impressão."); return; }
        w.document.write(`<!doctype html><meta charset="utf-8"><title>Relatório de cursos</title><style>body{font:12px system-ui;margin:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #bbb;padding:4px 6px;text-align:left}th{background:#eef}</style><h2>Relatório de cursos · ${esc(de)} a ${esc(ate)}</h2><table><tr>${r.cab.map((c) => `<th>${esc(c)}</th>`).join("")}</tr>${r.linhas.map((l) => `<tr>${l.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</table>`);
        w.document.close(); w.focus(); w.print();
      }
    } catch (e) { setErro(errorMessage(e)); }
  };
  const k = data?.kpis;
  const maxMat = useMemo(() => Math.max(1, ...(data?.maisAcessados.map((c) => c.matriculas) ?? [1])), [data]);
  return (
    <div className="relatorios">
      <header className="cursos-titulo linha"><div><h1>Relatórios</h1><p>Acompanhamento de treinamentos e desempenho.</p></div>
        <div className="grupo"><button className="btn btn--outline" onClick={() => exportar("csv")}><FileDown size={15} /> CSV</button><button className="btn btn--outline" onClick={() => exportar("pdf")}><FileDown size={15} /> PDF</button></div></header>
      <div className="catalogo-filtros">
        <label className="campo-linha">De <input type="date" value={de} max={ate} onChange={(e) => setDe(e.target.value)} /></label>
        <label className="campo-linha">Até <input type="date" value={ate} min={de} max={hoje} onChange={(e) => setAte(e.target.value)} /></label>
        <select aria-label="Setor" value={setor} onChange={(e) => setSetor(Number(e.target.value))}><option value={0}>Todos os setores</option>{base.data?.setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</select>
        <select aria-label="Curso" value={curso} onChange={(e) => setCurso(Number(e.target.value))}><option value={0}>Todos os cursos</option>{lista.data?.cursos.map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}</select>
      </div>
      {erro && <p className="erro-inline" role="alert">{erro}</p>}
      {isLoading || !k ? <Skeleton lines={6} /> : (
        <>
          <div className="cursos-metricas">
            <div><b>{k.alunos}</b><small>Alunos</small></div><div><b>{k.cursosPublicados}</b><small>Cursos publicados</small></div><div><b>{k.matriculasAtivas}</b><small>Matrículas ativas</small></div>
            <div><b>{k.taxaConclusao}%</b><small>Taxa de conclusão</small></div><div><b>{k.mediaAvaliacoes ?? "—"}</b><small>Média das avaliações</small></div><div><b>{k.horasTreinamento} h</b><small>Horas de treinamento</small></div>
          </div>
          <div className="cursos-duas">
            <Panel title="Conclusões por dia"><Serie pontos={data!.serie} /></Panel>
            <Panel title="Por setor"><Barras itens={data!.porSetor.map((s) => ({ rotulo: s.setor, valor: s.concluidos, max: Math.max(1, ...data!.porSetor.map((x) => x.matriculas)), extra: `${s.concluidos}/${s.matriculas}` }))} /></Panel>
          </div>
          <div className="cursos-duas">
            <Panel title="Cursos mais acessados"><Barras itens={data!.maisAcessados.map((c) => ({ rotulo: c.titulo, valor: c.matriculas, max: maxMat }))} /></Panel>
            <Panel title="Melhor desempenho">{data!.desempenho.length ? <Barras itens={data!.desempenho.map((d) => ({ rotulo: d.nome, valor: d.concluidos, max: data!.desempenho[0].concluidos, extra: `${d.concluidos} ${d.concluidos === 1 ? "curso" : "cursos"}` }))} /> : <p className="mudo">Ninguém concluiu cursos no período.</p>}</Panel>
          </div>
          <Panel title="Obrigatórios pendentes">
            {data!.pendentes.length ? <div className="tabela-admin" role="table"><div className="tr cab" role="row"><span>Funcionário</span><span>Setor</span><span>Pendentes</span><span>Atrasados</span></div>
              {data!.pendentes.map((p) => <div className="tr" role="row" key={p.id}><span><Link to={`/cursos/admin/aluno/${p.id}`}>{p.nome}</Link></span><span>{p.setor ?? "—"}</span><span>{p.pendentes}</span><span>{p.atrasados ? <Badge tone="crit">{p.atrasados}</Badge> : 0}</span></div>)}</div> : <p className="mudo">Ninguém com treinamento obrigatório pendente.</p>}
          </Panel>
        </>
      )}
    </div>
  );
}

// ---------- Trilhas ----------
interface TrilhaAdm { id: number; titulo: string; descricao: string | null; publicada: boolean; cursos: { curso_id: number; titulo: string }[] }
export function TrilhasAdmin() {
  const { data, isLoading } = useCursosQuery<{ trilhas: TrilhaAdm[] }>(["admin", "trilhas"], "/admin/trilhas", undefined, { staleTime: 0 });
  const todos = useCursosQuery<{ cursos: { id: number; titulo: string }[] }>(["admin", "cursos-todos"], "/admin/cursos", { limite: 100 });
  const [edit, setEdit] = useState<{ id?: number; titulo: string; descricao: string; publicada: boolean; cursoIds: number[] } | null>(null);
  const [erro, setErro] = useState("");
  const { pedir, dialogo } = useConfirmar();
  const inv = [["cursos", "admin", "trilhas"], ["cursos", "trilhas"]];
  const salvar = useCursosMutation(() => cursosApi.put(`/admin/trilhas${edit?.id ? `/${edit.id}` : ""}`, edit), inv, () => setEdit(null));
  const excluir = useCursosMutation((id: number) => cursosApi.del(`/admin/trilhas/${id}`), inv);
  const nome = (id: number) => todos.data?.cursos.find((c) => c.id === id)?.titulo ?? `Curso ${id}`;
  return (
    <div>
      <header className="cursos-titulo linha"><div><h1>Trilhas</h1><p>Agrupe cursos em uma sequência de formação.</p></div>
        <button className="btn btn--primary" onClick={() => setEdit({ titulo: "", descricao: "", publicada: false, cursoIds: [] })}><Plus size={16} /> Nova trilha</button></header>
      {isLoading ? <Skeleton lines={3} /> : data?.trilhas.length ? (
        <ul className="trilhas-adm">{data.trilhas.map((t) => (
          <li key={t.id}><div><strong>{t.titulo}</strong> <Badge tone={t.publicada ? "ok" : "warn"}>{t.publicada ? "Publicada" : "Rascunho"}</Badge><small>{t.cursos.map((c) => c.titulo).join(" → ") || "Sem cursos"}</small></div>
            <button className="btn btn--outline btn--sm" onClick={() => setEdit({ id: t.id, titulo: t.titulo, descricao: t.descricao ?? "", publicada: t.publicada, cursoIds: t.cursos.map((c) => c.curso_id) })}>Editar</button>
            <button className="btn btn--ghost btn--icon-sm" aria-label="Excluir trilha" onClick={() => pedir("Excluir trilha", `“${t.titulo}” será removida. Os cursos continuam existindo.`, () => excluir.mutate(t.id))}><Trash2 size={15} /></button></li>
        ))}</ul>
      ) : <EmptyState icon={Route} title="Nenhuma trilha criada">Exemplo: Trilha NOC, Trilha Desenvolvimento, Trilha Atendimento.</EmptyState>}
      {edit && (
        <div className="modal-fundo" role="dialog" aria-modal="true" aria-label="Trilha" onClick={() => setEdit(null)}>
          <div className="modal grande" onClick={(e) => e.stopPropagation()}>
            <h3>{edit.id ? "Editar trilha" : "Nova trilha"}</h3>
            <Campo rotulo="Título"><input value={edit.titulo} maxLength={200} onChange={(e) => setEdit({ ...edit, titulo: e.target.value })} /></Campo>
            <Campo rotulo="Descrição"><textarea rows={2} value={edit.descricao} onChange={(e) => setEdit({ ...edit, descricao: e.target.value })} /></Campo>
            <h4>Cursos na ordem</h4>
            <ol className="ed-opcoes">{edit.cursoIds.map((cid, i) => (
              <li className="linha" key={cid}><span className="grow">{nome(cid)}</span>
                <button className="btn btn--ghost btn--icon-sm" aria-label="Subir" disabled={i === 0} onClick={() => setEdit({ ...edit, cursoIds: mover(edit.cursoIds, i, i - 1) })}><ArrowUp size={14} /></button>
                <button className="btn btn--ghost btn--icon-sm" aria-label="Descer" disabled={i === edit.cursoIds.length - 1} onClick={() => setEdit({ ...edit, cursoIds: mover(edit.cursoIds, i, i + 1) })}><ArrowDown size={14} /></button>
                <button className="btn btn--ghost btn--icon-sm" aria-label="Remover" onClick={() => setEdit({ ...edit, cursoIds: edit.cursoIds.filter((x) => x !== cid) })}><Trash2 size={14} /></button></li>
            ))}</ol>
            <select aria-label="Adicionar curso" value="" onChange={(e) => e.target.value && setEdit({ ...edit, cursoIds: [...edit.cursoIds, Number(e.target.value)] })}>
              <option value="">Adicionar curso…</option>{todos.data?.cursos.filter((c) => !edit.cursoIds.includes(c.id)).map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}
            </select>
            <label className="campo-check"><input type="checkbox" checked={edit.publicada} onChange={(e) => setEdit({ ...edit, publicada: e.target.checked })} /> Publicada (visível aos funcionários)</label>
            {erro && <p className="erro-inline">{erro}</p>}
            <div className="modal-acoes"><button className="btn btn--outline" onClick={() => setEdit(null)}>Cancelar</button><button className="btn btn--primary" disabled={!edit.titulo.trim() || salvar.isPending} onClick={() => salvar.mutate(undefined, { onError: (e) => setErro(errorMessage(e)) })}>Salvar</button></div>
          </div>
        </div>
      )}
      {dialogo}
    </div>
  );
}

// ---------- Permissões e auditoria ----------
export function Configuracoes() {
  const base = useCursosQuery<DadosBase>(["admin", "base"], "/admin/dados-base", undefined, { staleTime: 60000 });
  const perm = useCursosQuery<{ admin: boolean }>(["permissoes"], "/permissoes");
  const gest = useCursosQuery<{ gestores: { usuario_id: number; nome: string }[] }>(["admin", "gestores"], "/admin/gestores", undefined, { staleTime: 0 });
  const aud = useCursosQuery<{ registros: { id: number; acao: string; entidade: string; entidade_id: number | null; criado_em: string; usuario: string | null; detalhes: any }[] }>(["admin", "auditoria"], "/admin/auditoria", undefined, { staleTime: 0 });
  const [erro, setErro] = useState("");
  const salvar = useCursosMutation((ids: number[]) => cursosApi.put("/admin/gestores", { usuarioIds: ids }), [["cursos", "admin", "gestores"]]);
  const ids = gest.data?.gestores.map((g) => g.usuario_id) ?? [];
  return (
    <div>
      <header className="cursos-titulo"><h1>Permissões e auditoria</h1><p>Quem gerencia cursos e o que foi alterado.</p></header>
      <Panel title="Responsáveis pelos cursos">
        <p className="mudo">Administradores do sistema sempre podem gerenciar. Aqui você libera outras pessoas.</p>
        <ul className="atribuicoes">{gest.data?.gestores.map((g) => <li key={g.usuario_id}><strong>{g.nome}</strong>{perm.data?.admin && <button className="btn btn--ghost btn--icon-sm" aria-label="Remover permissão" onClick={() => salvar.mutate(ids.filter((x) => x !== g.usuario_id), { onError: (e) => setErro(errorMessage(e)) })}><Trash2 size={14} /></button>}</li>)}
          {!gest.data?.gestores.length && <li className="mudo">Nenhuma pessoa adicional.</li>}</ul>
        {perm.data?.admin ? (
          <select aria-label="Adicionar responsável" value="" onChange={(e) => e.target.value && salvar.mutate([...ids, Number(e.target.value)], { onError: (er) => setErro(errorMessage(er)) })}>
            <option value="">Adicionar pessoa…</option>{base.data?.usuarios.filter((u) => !ids.includes(u.id)).map((u) => <option key={u.id} value={u.id}>{u.nome}{u.setor ? ` (${u.setor})` : ""}</option>)}
          </select>
        ) : <p className="mudo">Somente administradores podem alterar esta lista.</p>}
        {erro && <p className="erro-inline" role="alert">{erro}</p>}
      </Panel>
      <Panel title="Registro de alterações">
        {aud.data?.registros.length ? <ul className="auditoria">{aud.data.registros.map((r) => <li key={r.id}><b>{r.usuario ?? "—"}</b> {r.acao} {r.entidade}{r.entidade_id ? ` #${r.entidade_id}` : ""}{r.detalhes?.titulo ? ` “${r.detalhes.titulo}”` : ""}<small>{new Date(r.criado_em).toLocaleString("pt-BR")}</small></li>)}</ul> : <p className="mudo">Sem registros ainda.</p>}
      </Panel>
    </div>
  );
}
