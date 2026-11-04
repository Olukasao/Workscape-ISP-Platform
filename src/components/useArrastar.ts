import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";

export type Ponto = { x: number; y: number };

interface Opcoes {
  chave: string;
  /** Largura e altura do elemento (um número vale para os dois). Pode mudar com a tela. */
  tamanho: number | { w: number; h: number };
  padrao: () => Ponto;
  margem?: number;
  limiar?: number;
}

/** Janela menor que isso é uma janela minimizada (o Windows reporta algo como 160 x 28): não é para reposicionar nada. */
const JANELA_MINIMA = { w: 300, h: 200 };

/** Aperta a posição para dentro da janela, com a margem. */
export function dentroDaJanela(p: Ponto, w: number, h: number, janela: { w: number; h: number }, margem = 12): Ponto {
  return {
    x: Math.min(Math.max(margem, p.x), Math.max(margem, janela.w - w - margem)),
    y: Math.min(Math.max(margem, p.y), Math.max(margem, janela.h - h - margem)),
  };
}

/**
 * Onde o cartão fica depois que a janela mudou de tamanho. Devolve null quando a janela está minimizada (nada a fazer).
 * Posição escolhida pela pessoa volta a ela; sem escolha, acompanha o canto padrão da janela atual.
 */
export function posicaoAposRedimensionar(opcoes: {
  janela: { w: number; h: number };
  w: number;
  h: number;
  escolhida: Ponto | null;
  padrao: Ponto;
  margem?: number;
}): Ponto | null {
  const { janela, w, h, escolhida, padrao, margem = 12 } = opcoes;
  if (janela.w < JANELA_MINIMA.w || janela.h < JANELA_MINIMA.h) return null;
  return dentroDaJanela(escolhida ?? padrao, w, h, janela, margem);
}

/** Posição arrastável com o mouse ou o dedo, guardada no computador. Quem usa decide qual elemento é a alça. */
export function useArrastar({ chave, tamanho, padrao, margem = 12, limiar = 5 }: Opcoes) {
  const padraoRef = useRef(padrao);
  padraoRef.current = padrao;
  const w = typeof tamanho === "number" ? tamanho : tamanho.w;
  const h = typeof tamanho === "number" ? tamanho : tamanho.h;
  const limitar = useCallback(
    ({ x, y }: Ponto): Ponto => ({
      x: Math.min(Math.max(margem, x), Math.max(margem, window.innerWidth - w - margem)),
      y: Math.min(Math.max(margem, y), Math.max(margem, window.innerHeight - h - margem)),
    }),
    [margem, w, h],
  );
  // A posição que a pessoa quer (sem o "aperto" do tamanho atual da janela) e se foi ela quem escolheu.
  // Minimizar ou encolher a janela aperta o cartão contra a borda; ao voltar ao tamanho normal ele precisa voltar ao lugar.
  const desejada = useRef<Ponto | null>(null);
  const escolhida = useRef(false);
  const [posicao, setPosicao] = useState<Ponto>(() => {
    try {
      const salva = JSON.parse(localStorage.getItem(chave) || "null");
      if (Number.isFinite(salva?.x) && Number.isFinite(salva?.y)) {
        desejada.current = { x: salva.x, y: salva.y };
        escolhida.current = true;
        return limitar(salva);
      }
    } catch {
      /* posição salva inválida: usa a padrão */
    }
    return limitar(padrao());
  });
  const [arrastando, setArrastando] = useState(false);
  const arraste = useRef<{ id: number; ix: number; iy: number; origem: Ponto; moveu: boolean } | null>(null);
  const ignorarClique = useRef(false);

  useEffect(() => {
    const aoRedimensionar = () => {
      const nova = posicaoAposRedimensionar({
        janela: { w: window.innerWidth, h: window.innerHeight },
        w, h, margem,
        escolhida: escolhida.current ? desejada.current : null,
        padrao: padraoRef.current(),
      });
      if (nova) setPosicao(nova);
    };
    window.addEventListener("resize", aoRedimensionar);
    return () => window.removeEventListener("resize", aoRedimensionar);
  }, [w, h, margem]);

  const salvar = useCallback((nova: Ponto) => {
    desejada.current = nova;
    escolhida.current = true;
    const ajustada = limitar(nova);
    setPosicao(ajustada);
    try { localStorage.setItem(chave, JSON.stringify(ajustada)); } catch { /* vale só nesta sessão */ }
  }, [chave, limitar]);

  const vincular = {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      // Botões e campos dentro da alça continuam clicáveis; só a própria alça (ou a bolha) arrasta.
      const interno = (e.target as HTMLElement).closest("button, select, input, textarea, a");
      if (interno && interno !== e.currentTarget) return;
      arraste.current = { id: e.pointerId, ix: e.clientX, iy: e.clientY, origem: posicao, moveu: false };
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      const a = arraste.current;
      if (!a || a.id !== e.pointerId) return;
      const dx = e.clientX - a.ix, dy = e.clientY - a.iy;
      if (!a.moveu && Math.hypot(dx, dy) < limiar) return;
      if (!a.moveu) { a.moveu = true; setArrastando(true); }
      setPosicao(limitar({ x: a.origem.x + dx, y: a.origem.y + dy }));
    },
    onPointerUp: (e: PointerEvent<HTMLElement>) => finalizar(e),
    onPointerCancel: (e: PointerEvent<HTMLElement>) => finalizar(e),
  };
  function finalizar(e: PointerEvent<HTMLElement>) {
    const a = arraste.current;
    if (!a || a.id !== e.pointerId) return;
    arraste.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    if (a.moveu) {
      ignorarClique.current = true;
      setArrastando(false);
      salvar({ x: a.origem.x + e.clientX - a.ix, y: a.origem.y + e.clientY - a.iy });
    }
  }
  /** Chame no onClick: devolve true quando o "clique" foi só o fim de um arraste. */
  const foiArraste = () => {
    if (!ignorarClique.current) return false;
    ignorarClique.current = false;
    return true;
  };
  /** Muda a posição sem guardar (ex.: encostar a janela na bolha na primeira vez que abre). */
  const definir = useCallback((p: Ponto) => setPosicao(limitar(p)), [limitar]);
  return { posicao, arrastando, vincular, foiArraste, salvar, definir, redefinir: () => salvar(padrao()) };
}
