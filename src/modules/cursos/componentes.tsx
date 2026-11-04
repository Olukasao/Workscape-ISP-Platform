import { Link } from "react-router-dom";
import { Award, BookOpen, Clock, Heart, Layers, ShieldAlert } from "lucide-react";
import { clsx } from "clsx";
import { Badge } from "../../components/ui/primitives";
import { NIVEL_ROTULO, formatarData, formatarDuracao, urlDoServidor, type CursoResumo } from "./api";

/** Capa do curso; sem imagem, um fundo gerado a partir do título (estável entre aberturas). */
export function Capa({ capa, titulo, className }: { capa?: string | null; titulo: string; className?: string }) {
  if (capa) return <img className={clsx("curso-capa", className)} src={urlDoServidor(capa)} alt="" loading="lazy" />;
  let h = 0;
  for (const c of titulo) h = (h * 31 + c.charCodeAt(0)) % 360;
  const matiz = 205 + (h % 40);
  return (
    <div className={clsx("curso-capa gerada", className)} style={{ ["--capa-h" as string]: matiz }} aria-hidden="true">
      <span>{titulo.trim().slice(0, 2).toUpperCase()}</span>
    </div>
  );
}

export function Progresso({ valor, className, rotulo }: { valor: number; className?: string; rotulo?: string }) {
  return (
    <div className={clsx("progresso", className)} role="progressbar" aria-valuenow={valor} aria-valuemin={0} aria-valuemax={100} aria-label={rotulo ?? "Progresso"}>
      <i style={{ width: `${Math.min(100, Math.max(0, valor))}%` }} />
    </div>
  );
}

export function CartaoCurso({ c, onFavorito }: { c: CursoResumo; onFavorito?: (c: CursoResumo) => void }) {
  const atrasado = !c.concluido && c.prazoEm && new Date(c.prazoEm) < new Date(new Date().toISOString().slice(0, 10));
  return (
    <article className="curso-cartao">
      <Link to={`/cursos/curso/${c.id}`} className="curso-cartao-link" aria-label={c.titulo}>
        <Capa capa={c.capa} titulo={c.titulo} />
        <div className="curso-cartao-corpo">
          <div className="curso-cartao-meta">
            {c.categoria && <span>{c.categoria}</span>}
            <span className={clsx("nivel", c.nivel)}>{NIVEL_ROTULO[c.nivel]}</span>
          </div>
          <h3>{c.titulo}</h3>
          {c.instrutor && (
            <p className="instrutor">
              {c.instrutor_url ? (
                <span
                  role="link"
                  tabIndex={0}
                  className="instrutor-link"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(c.instrutor_url!, "_blank", "noopener,noreferrer"); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); window.open(c.instrutor_url!, "_blank", "noopener,noreferrer"); } }}
                >
                  {c.instrutor}
                </span>
              ) : c.instrutor}
            </p>
          )}
          <ul className="curso-cartao-info">
            <li><Clock size={13} /> {c.carga_horaria_min ? formatarDuracao(c.carga_horaria_min) : "—"}</li>
            <li><Layers size={13} /> {c.modulos} {c.modulos === 1 ? "módulo" : "módulos"}</li>
            <li><BookOpen size={13} /> {c.aulas} {c.aulas === 1 ? "aula" : "aulas"}</li>
            {c.emite_certificado ? <li><Award size={13} /> Certificado</li> : null}
          </ul>
          <div className="curso-cartao-selos">
            {c.obrigatorio && <Badge tone="warn">Obrigatório</Badge>}
            {atrasado && <Badge tone="crit"><ShieldAlert size={11} /> Atrasado</Badge>}
            {c.concluido && <Badge tone="ok">Concluído</Badge>}
          </div>
          <div className="curso-cartao-rodape">
            {c.matriculado ? (
              <>
                <Progresso valor={c.progresso} />
                <span>{c.concluido ? "Concluído" : `${c.progresso}%`}</span>
              </>
            ) : <span className="comecar">Começar curso</span>}
          </div>
        </div>
      </Link>
      {onFavorito && (
        <button type="button" className={clsx("favorito", c.favorito && "on")} aria-pressed={c.favorito} aria-label={c.favorito ? "Remover dos favoritos" : "Salvar para depois"} onClick={() => onFavorito(c)}>
          <Heart size={16} fill={c.favorito ? "currentColor" : "none"} />
        </button>
      )}
    </article>
  );
}

export const Prazo = ({ data }: { data?: string | null }) => (data ? <span>{formatarData(data)}</span> : null);

export function CartoesSkeleton({ n = 3 }: { n?: number }) {
  return <div className="curso-grade" aria-hidden="true">{Array.from({ length: n }, (_, i) => <div key={i} className="skeleton curso-skel" />)}</div>;
}
