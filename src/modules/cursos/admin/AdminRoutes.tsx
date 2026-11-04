import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { BarChart3, ClipboardCheck, Layers, Route as RouteIcon, ShieldCheck, Users } from "lucide-react";
import { EmptyState } from "../../../components/ui/primitives";
import { useCursosQuery } from "../api";
import AdminCursos from "./AdminCursos";
import EditorCurso from "./EditorCurso";
import EditorAula from "./EditorAula";
import { AlunoDetalhe, AlunosAdmin, Configuracoes, CorrigirTentativa, Correcoes, Relatorios, TrilhasAdmin } from "./Gestao";

/** O servidor também confere a permissão em cada chamada; aqui só se evita mostrar telas inúteis. */
export default function AdminRoutes() {
  const perm = useCursosQuery<{ gestor: boolean }>(["permissoes"], "/permissoes", undefined, { staleTime: 60000 });
  if (perm.isLoading) return null;
  if (!perm.data?.gestor) return <EmptyState icon={ShieldCheck} title="Acesso restrito">Você não tem permissão para gerenciar os cursos.</EmptyState>;
  const abas: [string, string, typeof Layers][] = [["/cursos/admin", "Cursos", Layers], ["/cursos/admin/alunos", "Funcionários", Users], ["/cursos/admin/relatorios", "Relatórios", BarChart3], ["/cursos/admin/correcoes", "Correções", ClipboardCheck], ["/cursos/admin/trilhas", "Trilhas", RouteIcon], ["/cursos/admin/config", "Permissões", ShieldCheck]];
  return (
    <div className="admin-shell">
      <nav className="admin-sub" aria-label="Gerenciamento">
        {abas.map(([to, r, I]) => <NavLink key={to} to={to} end={to === "/cursos/admin"} className={({ isActive }) => (isActive ? "on" : "")}><I size={15} />{r}</NavLink>)}
      </nav>
      <Routes>
        <Route index element={<AdminCursos />} />
        <Route path="curso/:id" element={<EditorCurso />} />
        <Route path="aula/:id" element={<EditorAula />} />
        <Route path="alunos" element={<AlunosAdmin />} />
        <Route path="aluno/:id" element={<AlunoDetalhe />} />
        <Route path="relatorios" element={<Relatorios />} />
        <Route path="correcoes" element={<Correcoes />} />
        <Route path="correcao/:id" element={<CorrigirTentativa />} />
        <Route path="trilhas" element={<TrilhasAdmin />} />
        <Route path="config" element={<Configuracoes />} />
        <Route path="*" element={<Navigate to="/cursos/admin" replace />} />
      </Routes>
    </div>
  );
}
