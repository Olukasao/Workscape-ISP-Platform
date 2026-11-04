import { useState } from "react";
import { Award, Download, Eye, X } from "lucide-react";
import { EmptyState, Skeleton } from "../../components/ui/primitives";
import { errorMessage, formatarData, formatarDuracao, useCursosQuery } from "./api";
import { baixarCertificadoPdf, certificadoSvg, type DadosCertificado } from "./certificado";

interface Linha { codigo: string; nome_aluno: string; curso_titulo: string; carga_horaria_min: number; nota: number | null; emitido_em: string }
const dados = (c: Linha): DadosCertificado => ({ codigo: c.codigo, aluno: c.nome_aluno, curso: c.curso_titulo, cargaHorariaMin: c.carga_horaria_min, emitidoEm: c.emitido_em, nota: c.nota });

export default function Certificados() {
  const { data, isLoading } = useCursosQuery<{ certificados: Linha[] }>(["certificados"], "/certificados");
  const [ver, setVer] = useState<Linha | null>(null);
  const [erro, setErro] = useState("");
  const baixar = async (c: Linha) => { setErro(""); try { await baixarCertificadoPdf(dados(c)); } catch (e) { setErro(errorMessage(e)); } };
  return (
    <div className="certificados">
      <header className="cursos-titulo"><h1>Meus certificados</h1><p>Documentos emitidos automaticamente ao concluir cada curso.</p></header>
      {isLoading ? <Skeleton lines={4} /> : data?.certificados.length ? (
        <ul className="certificados-lista">
          {data.certificados.map((c) => (
            <li key={c.codigo} className="certificado-item">
              <span className="selo-cert"><Award size={22} /></span>
              <div><strong>{c.curso_titulo}</strong><small>{formatarDuracao(c.carga_horaria_min)} · concluído em {formatarData(c.emitido_em)} · {c.codigo}</small></div>
              <button type="button" className="btn btn--outline btn--sm" onClick={() => setVer(c)}><Eye size={15} /> Visualizar</button>
              <button type="button" className="btn btn--primary btn--sm" onClick={() => baixar(c)}><Download size={15} /> Baixar PDF</button>
            </li>
          ))}
        </ul>
      ) : <EmptyState icon={Award} title="Nenhum certificado ainda">Conclua um curso com certificado para recebê-lo aqui.</EmptyState>}
      {erro && <p className="erro-inline" role="alert">{erro}</p>}
      {ver && (
        <div className="modal-fundo" role="dialog" aria-modal="true" aria-label="Certificado" onClick={() => setVer(null)}>
          <div className="modal grande" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="btn btn--ghost btn--icon fechar" aria-label="Fechar" onClick={() => setVer(null)}><X size={18} /></button>
            <div className="cert-previa" dangerouslySetInnerHTML={{ __html: certificadoSvg(dados(ver)) }} />
            <div className="modal-acoes"><button type="button" className="btn btn--primary" onClick={() => baixar(ver)}><Download size={15} /> Baixar PDF</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
