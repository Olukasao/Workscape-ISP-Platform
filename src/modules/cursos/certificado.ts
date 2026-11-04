import qrcode from "qrcode-generator";
import { useServers } from "../../stores/workspace";

export interface DadosCertificado { codigo: string; aluno: string; curso: string; cargaHorariaMin: number; emitidoEm: string; nota?: number | null }

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const W = 1754, H = 1240; // A4 paisagem a 150 dpi

export function enderecoVerificacao(codigo: string) {
  const origem = useServers.getState().config.chat || "http://192.168.1.133:8600";
  return `${origem}/api/cursos/verificar/${codigo}`;
}

function qrSvg(texto: string, x: number, y: number, tam: number) {
  const q = qrcode(0, "M");
  q.addData(texto);
  q.make();
  const n = q.getModuleCount();
  const c = tam / n;
  let d = "";
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) d += `M${(x + k * c).toFixed(2)} ${(y + r * c).toFixed(2)}h${(c + 0.4).toFixed(2)}v${(c + 0.4).toFixed(2)}h-${(c + 0.4).toFixed(2)}z`;
  return `<rect x="${x - 14}" y="${y - 14}" width="${tam + 28}" height="${tam + 28}" rx="10" fill="#fff"/><path d="${d}" fill="#050b1f"/>`;
}
function quebrar(texto: string, max: number) {
  const palavras = texto.split(" "); const linhas: string[] = []; let atual = "";
  for (const p of palavras) { if ((atual + " " + p).trim().length > max) { linhas.push(atual); atual = p; } else atual = (atual + " " + p).trim(); }
  if (atual) linhas.push(atual);
  return linhas.slice(0, 3);
}

/** Certificado em SVG, com a identidade AcessaNet (navy, azul elétrico e as três trilhas do logo). */
export function certificadoSvg(d: DadosCertificado): string {
  const data = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(d.emitidoEm));
  const horas = d.cargaHorariaMin ? `${Math.round((d.cargaHorariaMin / 60) * 10) / 10} horas` : "carga horária não informada";
  const curso = quebrar(d.curso, 46);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Segoe UI, Helvetica, Arial, sans-serif">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#050b1f"/><stop offset="1" stop-color="#0a1633"/></linearGradient>
<linearGradient id="el" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2f6bff"/><stop offset="1" stop-color="#3ad6ff"/></linearGradient>
<radialGradient id="gl" cx="85%" cy="0%" r="70%"><stop offset="0" stop-color="#2f6bff" stop-opacity=".32"/><stop offset="1" stop-color="#2f6bff" stop-opacity="0"/></radialGradient>
</defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/><rect width="${W}" height="${H}" fill="url(#gl)"/>
<rect x="46" y="46" width="${W - 92}" height="${H - 92}" rx="22" fill="none" stroke="url(#el)" stroke-width="3"/>
<rect x="64" y="64" width="${W - 128}" height="${H - 128}" rx="14" fill="none" stroke="#8fb2ff" stroke-opacity=".22" stroke-width="1.5"/>
<g transform="translate(120 120)"><rect width="9" height="62" rx="4.5" fill="#2f6bff"/><rect x="18" y="12" width="9" height="50" rx="4.5" fill="#17b26a"/><rect x="36" y="24" width="9" height="38" rx="4.5" fill="#f5a524"/>
<text x="68" y="44" fill="#eef3ff" font-size="40" font-weight="700" letter-spacing="1">AcessaNet</text></g>
<text x="${W - 120}" y="168" text-anchor="end" fill="#8fb2ff" font-size="22" letter-spacing="6">UNIVERSIDADE CORPORATIVA</text>
<text x="${W / 2}" y="375" text-anchor="middle" fill="#3ad6ff" font-size="26" letter-spacing="14" font-weight="600">CERTIFICADO DE CONCLUSÃO</text>
<text x="${W / 2}" y="470" text-anchor="middle" fill="#e2ebff" fill-opacity=".72" font-size="30">Certificamos que</text>
<text x="${W / 2}" y="590" text-anchor="middle" fill="#ffffff" font-size="${d.aluno.length > 30 ? 66 : 84}" font-weight="700" font-family="Georgia, 'Times New Roman', serif">${esc(d.aluno)}</text>
<rect x="${W / 2 - 150}" y="628" width="300" height="4" rx="2" fill="url(#el)"/>
<text x="${W / 2}" y="706" text-anchor="middle" fill="#e2ebff" fill-opacity=".72" font-size="30">concluiu com aproveitamento o curso</text>
${curso.map((l, i) => `<text x="${W / 2}" y="${790 + i * 62}" text-anchor="middle" fill="#8fb2ff" font-size="54" font-weight="700">${esc(l)}</text>`).join("")}
<text x="${W / 2}" y="${790 + curso.length * 62 + 20}" text-anchor="middle" fill="#e2ebff" fill-opacity=".72" font-size="28">com carga horária de ${horas}${d.nota != null ? `, nota final ${Math.round(Number(d.nota))}` : ""}.</text>
<text x="120" y="${H - 150}" fill="#eef3ff" font-size="28" font-weight="600">${esc(data)}</text>
<text x="120" y="${H - 112}" fill="#8fb2ff" fill-opacity=".8" font-size="21">Data de conclusão</text>
<text x="120" y="${H - 190}" fill="#8fb2ff" fill-opacity=".6" font-size="19" letter-spacing="2">CÓDIGO ${esc(d.codigo)}</text>
<g transform="translate(${W / 2 - 180} ${H - 190})"><line x1="0" y1="0" x2="360" y2="0" stroke="#8fb2ff" stroke-opacity=".5"/><text x="180" y="34" text-anchor="middle" fill="#e2ebff" fill-opacity=".8" font-size="22">AcessaNet · Treinamento e Desenvolvimento</text></g>
${qrSvg(enderecoVerificacao(d.codigo), W - 330, H - 330, 170)}
<text x="${W - 245}" y="${H - 118}" text-anchor="middle" fill="#8fb2ff" fill-opacity=".8" font-size="18">Verifique a autenticidade</text>
</svg>`;
}

async function paraJpeg(svg: string): Promise<Uint8Array> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    await new Promise<void>((ok, no) => { img.onload = () => ok(); img.onerror = () => no(new Error("Não foi possível desenhar o certificado.")); img.src = url; });
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    canvas.getContext("2d")!.drawImage(img, 0, 0, W, H);
    const blob: Blob = await new Promise((ok, no) => canvas.toBlob((b) => (b ? ok(b) : no(new Error("Falha ao gerar a imagem."))), "image/jpeg", 0.94));
    return new Uint8Array(await blob.arrayBuffer());
  } finally { URL.revokeObjectURL(url); }
}

/** PDF de uma página (A4 paisagem) contendo o certificado como imagem JPEG. */
export function montarPdf(jpeg: Uint8Array, titulo: string): Uint8Array {
  const enc = new TextEncoder();
  const pw = 841.89, ph = 595.28;
  const partes: Uint8Array[] = [];
  const offsets: number[] = [];
  let tam = 0;
  const add = (b: Uint8Array | string) => { const u = typeof b === "string" ? enc.encode(b) : b; partes.push(u); tam += u.length; };
  const obj = (n: number, corpo: Uint8Array | string) => { offsets[n] = tam; add(`${n} 0 obj\n`); add(corpo); add("\nendobj\n"); };
  add("%PDF-1.4\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  offsets[4] = tam;
  add(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${W} /Height ${H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
  add(jpeg); add("\nendstream\nendobj\n");
  const conteudo = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`;
  obj(5, `<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream`);
  const info = titulo.replace(/[^\x20-\x7e]/g, "").replace(/[()\\]/g, "");
  obj(6, `<< /Title (${info}) /Producer (AcessaNet Workspace) >>`);
  const xref = tam;
  add(`xref\n0 7\n0000000000 65535 f \n${offsets.slice(1).map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`);
  add(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF`);
  const saida = new Uint8Array(tam);
  let p = 0;
  for (const b of partes) { saida.set(b, p); p += b.length; }
  return saida;
}

export async function baixarCertificadoPdf(d: DadosCertificado) {
  const pdf = montarPdf(await paraJpeg(certificadoSvg(d)), `Certificado ${d.curso}`);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([pdf as BlobPart], { type: "application/pdf" }));
  a.download = `certificado-${d.codigo}.pdf`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
