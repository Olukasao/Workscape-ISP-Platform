import { Fragment, type ReactNode } from "react";

// Markdown mínimo e seguro para as respostas da IA: nada de HTML bruto, só elementos React.
// Links só http(s); abrem fora do app.

function inline(texto: string, chave: string): ReactNode[] {
  const saida: ReactNode[] = [];
  const re = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\s][^*\n]*\*)|(\[[^\]\n]+\]\(https?:\/\/[^\s)]+\))/g;
  let ultimo = 0;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = re.exec(texto))) {
    if (m.index > ultimo) saida.push(texto.slice(ultimo, m.index));
    const t = m[0];
    const k = `${chave}-${n++}`;
    if (m[1]) saida.push(<code key={k}>{t.slice(1, -1)}</code>);
    else if (m[2]) saida.push(<strong key={k}>{inline(t.slice(2, -2), k)}</strong>);
    else if (m[3]) saida.push(<em key={k}>{inline(t.slice(1, -1), k)}</em>);
    else {
      const meio = t.indexOf("](");
      saida.push(
        <a key={k} href={t.slice(meio + 2, -1)} target="_blank" rel="noopener noreferrer">
          {t.slice(1, meio)}
        </a>,
      );
    }
    ultimo = m.index + t.length;
  }
  if (ultimo < texto.length) saida.push(texto.slice(ultimo));
  return saida;
}

export default function Markdown({ texto }: { texto: string }) {
  const linhas = texto.replace(/\r\n/g, "\n").split("\n");
  const blocos: ReactNode[] = [];
  let i = 0;
  let b = 0;
  while (i < linhas.length) {
    const linha = linhas[i];
    if (!linha.trim()) { i++; continue; }
    const cerca = /^```(\w*)/.exec(linha);
    if (cerca) {
      const codigo: string[] = [];
      i++;
      while (i < linhas.length && !linhas[i].startsWith("```")) codigo.push(linhas[i++]);
      i++;
      blocos.push(<pre key={b++}><code>{codigo.join("\n")}</code></pre>);
      continue;
    }
    const titulo = /^(#{1,4})\s+(.*)$/.exec(linha);
    if (titulo) {
      blocos.push(<p key={b++} className="md-titulo">{inline(titulo[2], `t${b}`)}</p>);
      i++;
      continue;
    }
    if (/^\s*([-*•])\s+/.test(linha)) {
      const itens: string[] = [];
      while (i < linhas.length && /^\s*([-*•])\s+/.test(linhas[i])) itens.push(linhas[i++].replace(/^\s*([-*•])\s+/, ""));
      blocos.push(<ul key={b++}>{itens.map((t, k) => <li key={k}>{inline(t, `u${b}-${k}`)}</li>)}</ul>);
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(linha)) {
      const itens: string[] = [];
      while (i < linhas.length && /^\s*\d+[.)]\s+/.test(linhas[i])) itens.push(linhas[i++].replace(/^\s*\d+[.)]\s+/, ""));
      blocos.push(<ol key={b++}>{itens.map((t, k) => <li key={k}>{inline(t, `o${b}-${k}`)}</li>)}</ol>);
      continue;
    }
    if (/^>\s?/.test(linha)) {
      const citacao: string[] = [];
      while (i < linhas.length && /^>\s?/.test(linhas[i])) citacao.push(linhas[i++].replace(/^>\s?/, ""));
      blocos.push(<blockquote key={b++}>{inline(citacao.join(" "), `q${b}`)}</blockquote>);
      continue;
    }
    // Parágrafo: junta linhas seguidas até uma linha em branco ou o início de outro bloco.
    const par: string[] = [];
    while (i < linhas.length && linhas[i].trim() && !/^(```|#{1,4}\s|\s*([-*•]|\d+[.)])\s|>)/.test(linhas[i])) par.push(linhas[i++]);
    if (!par.length) { par.push(linhas[i++]); }
    blocos.push(
      <p key={b++}>
        {par.map((t, k) => (
          <Fragment key={k}>{k > 0 ? <br /> : null}{inline(t, `p${b}-${k}`)}</Fragment>
        ))}
      </p>,
    );
  }
  return <div className="md">{blocos}</div>;
}
