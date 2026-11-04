import { useEffect, useState } from "react";
import { Heart, Search, SearchX } from "lucide-react";
import { EmptyState } from "../../components/ui/primitives";
import { useCursosQuery, type CursoResumo } from "./api";
import { CartaoCurso, CartoesSkeleton } from "./componentes";
import { useFavorito } from "./Home";

export default function Catalogo() {
  const [q, setQ] = useState("");
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState(0);
  const [nivel, setNivel] = useState("");
  const [ordem, setOrdem] = useState("recentes");
  const [favoritos, setFavoritos] = useState(false);
  const [pagina, setPagina] = useState(1);
  useEffect(() => { const t = setTimeout(() => { setBusca(q); setPagina(1); }, 300); return () => clearTimeout(t); }, [q]);
  const cats = useCursosQuery<{ categorias: { id: number; nome: string }[] }>(["categorias"], "/categorias", undefined, { staleTime: 60000 });
  const params = { q: busca || undefined, categoria: categoria || undefined, nivel: nivel || undefined, ordem, favoritos: favoritos ? 1 : undefined, pagina };
  const lista = useCursosQuery<{ cursos: CursoResumo[]; temMais: boolean }>(["catalogo", params], "/catalogo", params);
  const fav = useFavorito();
  const trocar = (fn: () => void) => { fn(); setPagina(1); };
  return (
    <div className="catalogo">
      <header className="cursos-titulo"><h1>Catálogo de cursos</h1><p>Pesquise, filtre e comece quando quiser.</p></header>
      <div className="catalogo-filtros">
        <label className="busca"><Search size={16} /><input type="search" placeholder="Buscar por curso, assunto ou instrutor" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <select aria-label="Nível" value={nivel} onChange={(e) => trocar(() => setNivel(e.target.value))}>
          <option value="">Todos os níveis</option><option value="basico">Básico</option><option value="intermediario">Intermediário</option><option value="avancado">Avançado</option>
        </select>
        <select aria-label="Ordenar" value={ordem} onChange={(e) => trocar(() => setOrdem(e.target.value))}>
          <option value="recentes">Mais recentes</option><option value="acessados">Mais acessados</option><option value="titulo">Ordem alfabética</option><option value="duracao">Menor duração</option>
        </select>
        <button type="button" className="btn btn--outline" aria-pressed={favoritos} onClick={() => trocar(() => setFavoritos((v) => !v))}><Heart size={15} /> Favoritos</button>
      </div>
      <div className="catalogo-categorias" role="tablist" aria-label="Categorias">
        <button role="tab" aria-selected={categoria === 0} className={categoria === 0 ? "on" : ""} onClick={() => trocar(() => setCategoria(0))}>Todas</button>
        {cats.data?.categorias.map((c) => <button key={c.id} role="tab" aria-selected={categoria === c.id} className={categoria === c.id ? "on" : ""} onClick={() => trocar(() => setCategoria(c.id))}>{c.nome}</button>)}
      </div>
      {lista.isLoading ? <CartoesSkeleton n={6} /> : lista.data?.cursos.length ? (
        <>
          <div className="curso-grade">{lista.data.cursos.map((c) => <CartaoCurso key={c.id} c={c} onFavorito={(x) => fav.mutate(x)} />)}</div>
          <nav className="paginacao" aria-label="Paginação">
            <button type="button" className="btn btn--outline btn--sm" disabled={pagina === 1} onClick={() => setPagina((p) => p - 1)}>Anterior</button>
            <span>Página {pagina}</span>
            <button type="button" className="btn btn--outline btn--sm" disabled={!lista.data.temMais} onClick={() => setPagina((p) => p + 1)}>Próxima</button>
          </nav>
        </>
      ) : <EmptyState icon={SearchX} title="Nenhum curso encontrado">Tente outros termos ou limpe os filtros.</EmptyState>}
    </div>
  );
}
