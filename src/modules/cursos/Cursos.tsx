import { lazy, Suspense, useEffect, useState } from "react";
import { NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Award, Compass, GraduationCap, Home, Library, Route as RouteIcon, Search, Settings2, Trophy } from "lucide-react";
import { PageSkeleton } from "../../components/ui/primitives";
import { useCursosQuery } from "./api";
import CursosHome from "./Home";
import Catalogo from "./Catalogo";
import CursoPagina from "./CursoPagina";
import Player from "./Player";
import Certificados from "./Certificados";
import MinhaJornada, { Biblioteca, Trilhas } from "./Jornada";
import "./cursos.css";

const Admin = lazy(() => import("./admin/AdminRoutes"));

function BuscaGlobal() {
  const [q, setQ] = useState("");
  const [busca, setBusca] = useState("");
  const navigate = useNavigate();
  useEffect(() => { const t = setTimeout(() => setBusca(q.trim()), 250); return () => clearTimeout(t); }, [q]);
  const { data } = useCursosQuery<{ cursos: { id: number; titulo: string }[]; aulas: { id: number; titulo: string; curso: string; modulo: string }[] }>(["busca", busca], "/busca", { q: busca }, { enabled: busca.length >= 2 });
  const ir = (to: string) => { setQ(""); navigate(to); };
  return (
    <div className="cursos-busca">
      <Search size={15} aria-hidden="true" />
      <input type="search" aria-label="Buscar cursos, módulos e aulas" placeholder="Buscar cursos, módulos e aulas" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setQ("")} />
      {busca.length >= 2 && q && (
        <div className="cursos-busca-res" role="listbox">
          {data?.cursos.map((c) => <button key={`c${c.id}`} role="option" aria-selected="false" onClick={() => ir(`/cursos/curso/${c.id}`)}><b>Curso</b>{c.titulo}</button>)}
          {data?.aulas.map((a) => <button key={`a${a.id}`} role="option" aria-selected="false" onClick={() => ir(`/cursos/aula/${a.id}`)}><b>Aula</b>{a.titulo}<small>{a.curso} · {a.modulo}</small></button>)}
          {data && !data.cursos.length && !data.aulas.length && <p className="mudo">Nada encontrado.</p>}
        </div>
      )}
    </div>
  );
}

export default function Cursos() {
  const { pathname } = useLocation();
  const perm = useCursosQuery<{ gestor: boolean }>(["permissoes"], "/permissoes", undefined, { staleTime: 60000 });
  const imersivo = pathname.startsWith("/cursos/aula/");
  const abas: [string, string, typeof Home][] = [
    ["/cursos", "Início", Home], ["/cursos/catalogo", "Catálogo", Compass], ["/cursos/trilhas", "Trilhas", RouteIcon],
    ["/cursos/certificados", "Certificados", Award], ["/cursos/jornada", "Minha jornada", Trophy], ["/cursos/biblioteca", "Biblioteca", Library],
  ];
  return (
    <div className={`cursos ${imersivo ? "imersivo" : ""}`}>
      {!imersivo && (
        <div className="cursos-barra">
          <div className="cursos-marca"><GraduationCap size={18} /><strong>Cursos</strong></div>
          <nav className="cursos-abas" aria-label="Seções dos cursos">
            {abas.map(([to, r, Icone]) => <NavLink key={to} to={to} end={to === "/cursos"} className={({ isActive }) => (isActive ? "on" : "")}><Icone size={15} />{r}</NavLink>)}
            {perm.data?.gestor && <NavLink to="/cursos/admin" className={({ isActive }) => (isActive ? "on admin" : "admin")}><Settings2 size={15} />Gerenciar</NavLink>}
          </nav>
          <BuscaGlobal />
        </div>
      )}
      <div className="cursos-area">
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            <Route index element={<CursosHome />} />
            <Route path="catalogo" element={<Catalogo />} />
            <Route path="curso/:id" element={<CursoPagina />} />
            <Route path="aula/:id" element={<Player />} />
            <Route path="certificados" element={<Certificados />} />
            <Route path="jornada" element={<MinhaJornada />} />
            <Route path="trilhas" element={<Trilhas />} />
            <Route path="biblioteca" element={<Biblioteca />} />
            <Route path="admin/*" element={<Admin />} />
            <Route path="*" element={<CursosHome />} />
          </Routes>
        </Suspense>
      </div>
    </div>
  );
}
