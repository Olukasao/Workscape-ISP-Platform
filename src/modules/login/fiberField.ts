// Feixe de fibras ópticas do login: fios finos saem da borda da janela e convergem para o formulário.
// Pulsos de luz percorrem os fios (sozinhos, a cada tecla digitada e, no acesso, todos de uma vez).
type Ponto = { x: number; y: number };
interface Fio { a: Ponto; c1: Ponto; c2: Ponto; fase: number; largura: number; pts: Ponto[] }
interface Pulso { fio: number; t: number; vel: number; comp: number; cor: string; forca: number }

const AMOSTRAS = 72;
const COR_FIO = "47, 107, 255";
const CORES_PULSO = { normal: "159, 211, 255", forte: "234, 242, 255", falha: "255, 90, 110" };

function bezier(a: Ponto, c1: Ponto, c2: Ponto, b: Ponto, t: number): Ponto {
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x,
    y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y,
  };
}

export class FiberField {
  private ctx: CanvasRenderingContext2D;
  private fios: Fio[] = [];
  private pulsos: Pulso[] = [];
  private alvo: Ponto = { x: 0, y: 0 };
  private w = 0;
  private h = 0;
  private quadro = 0;
  private ultimo = 0;
  private proximoAmbiente = 0;
  private brilho = 0; // 0..1, sobe no acesso confirmado
  private falha = 0; // 0..1, sobe em senha errada
  private parado: boolean;

  constructor(private canvas: HTMLCanvasElement, private alvoEl: () => DOMRect | null, reduzido: boolean) {
    this.ctx = canvas.getContext("2d")!;
    this.parado = reduzido;
    this.redimensionar();
    window.addEventListener("resize", this.redimensionar);
    this.quadro = requestAnimationFrame(this.passo);
  }

  destruir() {
    cancelAnimationFrame(this.quadro);
    window.removeEventListener("resize", this.redimensionar);
  }

  /** Um pulso por tecla: a luz corre por um fio até o formulário. */
  tecla() {
    if (this.parado) return;
    this.lancar(1, CORES_PULSO.normal, 1.15, 0.85);
  }

  /** Acesso confirmado: todos os fios acendem e a luz converge. */
  acesso() {
    this.brilho = 1;
    if (this.parado) { this.desenhar(0); return; }
    for (let i = 0; i < this.fios.length; i++)
      this.pulsos.push({ fio: i, t: -Math.random() * 0.25, vel: 1.6 + Math.random() * 0.5, comp: 0.32, cor: CORES_PULSO.forte, forca: 1 });
  }

  /** Senha errada: os fios piscam em vermelho por um instante. */
  erro() {
    this.falha = 1;
    if (this.parado) { this.desenhar(0); return; }
    this.lancar(5, CORES_PULSO.falha, 1.4, 0.9);
  }

  private lancar(n: number, cor: string, vel: number, forca: number) {
    for (let k = 0; k < n; k++)
      this.pulsos.push({ fio: Math.floor(Math.random() * this.fios.length), t: 0, vel: vel * (0.85 + Math.random() * 0.3), comp: 0.14 + Math.random() * 0.08, cor, forca });
  }

  private redimensionar = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = this.canvas.getBoundingClientRect();
    this.w = r.width;
    this.h = r.height;
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.criarFios();
    if (this.parado) this.desenhar(0);
  };

  private calcularAlvo() {
    const rect = this.alvoEl();
    const c = this.canvas.getBoundingClientRect();
    if (!rect) { this.alvo = { x: this.w * 0.7, y: this.h * 0.5 }; return; }
    // Os fios entram pela borda esquerda do formulário (ou pelo topo, quando ele está centralizado).
    const centralizado = rect.left - c.left < this.w * 0.25;
    this.alvo = centralizado
      ? { x: rect.left - c.left + rect.width / 2, y: rect.top - c.top + 8 }
      : { x: rect.left - c.left + 6, y: rect.top - c.top + rect.height * 0.42 };
  }

  private criarFios() {
    this.calcularAlvo();
    const n = Math.round(Math.min(34, Math.max(18, this.w / 42)));
    // Semente fixa: o desenho é o mesmo a cada abertura.
    let s = 7;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    this.fios = Array.from({ length: n }, (_, i) => {
      const f = i / (n - 1);
      // Origem espalhada pela borda esquerda e pela base da janela.
      const a = f < 0.45
        ? { x: -20, y: this.h * (0.08 + (f / 0.45) * 0.92) }
        : { x: ((f - 0.45) / 0.55) * this.alvo.x * 0.95, y: this.h + 20 };
      const meio = { x: this.alvo.x * (0.35 + rnd() * 0.25), y: a.y + (this.alvo.y - a.y) * (0.2 + rnd() * 0.3) };
      return {
        a,
        c1: { x: meio.x * 0.6 + a.x * 0.4, y: meio.y },
        c2: { x: this.alvo.x - 40 - rnd() * 160, y: this.alvo.y + (rnd() - 0.5) * 60 },
        fase: rnd() * Math.PI * 2,
        largura: 0.6 + rnd() * 0.9,
        pts: [],
      };
    });
  }

  private amostrar(tempo: number) {
    this.calcularAlvo();
    for (const f of this.fios) {
      // Ondulação lenta, como fibra solta no ar.
      const o = this.parado ? 0 : Math.sin(tempo * 0.00035 + f.fase) * 14;
      const c1 = { x: f.c1.x + o, y: f.c1.y - o * 0.6 };
      const c2 = { x: f.c2.x - o * 0.4, y: f.c2.y + o * 0.5 };
      f.pts = Array.from({ length: AMOSTRAS + 1 }, (_, k) => bezier(f.a, c1, c2, this.alvo, k / AMOSTRAS));
    }
  }

  private passo = (agora: number) => {
    const dt = this.ultimo ? Math.min((agora - this.ultimo) / 1000, 0.05) : 0;
    this.ultimo = agora;
    if (agora > this.proximoAmbiente) {
      this.lancar(1, CORES_PULSO.normal, 0.32, 0.55);
      this.proximoAmbiente = agora + 520 + Math.random() * 900;
    }
    this.desenhar(agora, dt);
    if (!this.parado) this.quadro = requestAnimationFrame(this.passo);
  };

  private desenhar(agora: number, dt = 0) {
    const { ctx } = this;
    this.amostrar(agora);
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.globalCompositeOperation = "source-over";
    ctx.lineCap = "round";
    const base = 0.16 + this.brilho * 0.5;
    for (const f of this.fios) {
      ctx.beginPath();
      f.pts.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.strokeStyle = this.falha > 0.01
        ? `rgba(255, 90, 110, ${0.1 + this.falha * 0.35})`
        : `rgba(${COR_FIO}, ${base})`;
      ctx.lineWidth = f.largura;
      ctx.stroke();
    }
    // Pulsos: segmento com cabeça brilhante e cauda que some.
    ctx.globalCompositeOperation = "lighter";
    this.pulsos = this.pulsos.filter((p) => p.t - p.comp < 1);
    for (const p of this.pulsos) {
      p.t += p.vel * dt;
      const f = this.fios[p.fio];
      if (!f || p.t <= 0) continue;
      const fim = Math.min(1, p.t);
      const ini = Math.max(0, p.t - p.comp);
      const k0 = Math.floor(ini * AMOSTRAS);
      const k1 = Math.ceil(fim * AMOSTRAS);
      for (let k = k0; k < k1; k++) {
        const a = f.pts[k], b = f.pts[k + 1];
        const pos = (k - k0) / Math.max(1, k1 - k0);
        ctx.strokeStyle = `rgba(${p.cor}, ${pos * pos * p.forca})`;
        ctx.lineWidth = f.largura + 1.4 * pos;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      const cabeca = f.pts[Math.min(AMOSTRAS, Math.round(fim * AMOSTRAS))];
      const g = ctx.createRadialGradient(cabeca.x, cabeca.y, 0, cabeca.x, cabeca.y, 10);
      g.addColorStop(0, `rgba(${p.cor}, ${0.9 * p.forca})`);
      g.addColorStop(1, `rgba(${p.cor}, 0)`);
      ctx.fillStyle = g;
      ctx.fillRect(cabeca.x - 10, cabeca.y - 10, 20, 20);
    }
    // Ponto de chegada: acende conforme a luz chega ao formulário.
    const chegada = 0.25 + this.brilho * 0.75 + Math.min(0.4, this.pulsos.filter((p) => p.t >= 0.92).length * 0.08);
    const g = ctx.createRadialGradient(this.alvo.x, this.alvo.y, 0, this.alvo.x, this.alvo.y, 90 + this.brilho * 220);
    g.addColorStop(0, `rgba(${this.falha > 0.01 ? "255, 90, 110" : "120, 170, 255"}, ${0.35 * chegada})`);
    g.addColorStop(1, "rgba(47, 107, 255, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
    this.falha = Math.max(0, this.falha - dt * 1.6);
    if (this.brilho > 0 && this.brilho < 1) this.brilho = Math.max(0, this.brilho - dt * 0.5);
  }
}
