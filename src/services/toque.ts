// Assinatura sonora do telefone do Workspace, gerada na hora (sem arquivo de áudio). Tudo parte do mesmo motivo,
// um arpejo curto de Mi maior (Mi5, Sol#5, Si5), para toque, atender, desligar e perdida soarem como da mesma marca.
// O toque de chamada recebida é alto e agudo de propósito; os sons curtos (atendeu, desligou, perdida) continuam suaves.
const SOL_SUST5 = 830.61;
const SI5 = 987.77;
const MI6 = 1318.51;
const SI4 = 493.88;

type Nota = { freq: number; inicio: number; duracao: number; ganho?: number };

function tocarNotas(ctx: AudioContext, notas: Nota[]) {
  const agora = ctx.currentTime;
  for (const n of notas) {
    const osc = ctx.createOscillator();
    const ganho = ctx.createGain();
    osc.type = "triangle"; // macio, sem o brilho áspero do quadrado
    osc.frequency.value = n.freq;
    const pico = n.ganho ?? 0.11;
    ganho.gain.setValueAtTime(0.0001, agora + n.inicio);
    ganho.gain.exponentialRampToValueAtTime(pico, agora + n.inicio + 0.02);
    ganho.gain.exponentialRampToValueAtTime(0.0001, agora + n.inicio + n.duracao);
    osc.connect(ganho).connect(ctx.destination);
    osc.start(agora + n.inicio);
    osc.stop(agora + n.inicio + n.duracao + 0.03);
  }
}

/** Um "trrrrim" de telefone: dois tons agudos alternando rápido, em onda quadrada (cheia de harmônicos, ouve-se até em alto-falante pequeno). */
function tocarTrim(ctx: AudioContext, destino: AudioNode, inicio: number, duracao: number) {
  const agora = ctx.currentTime + inicio;
  const ganho = ctx.createGain();
  ganho.gain.setValueAtTime(0.0001, agora);
  ganho.gain.exponentialRampToValueAtTime(1, agora + 0.015);
  ganho.gain.setValueAtTime(1, agora + duracao - 0.04);
  ganho.gain.exponentialRampToValueAtTime(0.0001, agora + duracao);
  ganho.connect(destino);
  // Dois osciladores (o segundo uma oitava abaixo) dão corpo; alternam entre dois tons a cada 50 ms, o timbre de "campainha".
  for (const [oitava, nivel] of [[1, 1], [0.5, 0.7]] as const) {
    const osc = ctx.createOscillator();
    const nv = ctx.createGain();
    nv.gain.value = nivel;
    osc.type = "square";
    for (let t = 0; t < duracao; t += 0.05) osc.frequency.setValueAtTime((Math.round(t / 0.05) % 2 === 0 ? 1318.51 : 1046.5) * oitava, agora + t);
    osc.connect(nv).connect(ganho);
    osc.start(agora);
    osc.stop(agora + duracao + 0.03);
  }
}

/** Toque de chamada recebida, alto de propósito (as pessoas não estavam ouvindo): dois "trrrrim" a cada 3 segundos. Devolve a função que para o toque. */
export function iniciarToque(): () => void {
  let ctx: AudioContext | null = null;
  try { ctx = new AudioContext(); } catch { return () => {}; }
  const audio = ctx;
  // O compressor segura os picos e deixa o toque mais "forte" sem estourar o alto-falante.
  const compressor = audio.createDynamicsCompressor();
  compressor.threshold.value = -24;
  compressor.ratio.value = 20;
  compressor.knee.value = 0;
  const saida = audio.createGain();
  saida.gain.value = 2.5;
  compressor.connect(saida).connect(audio.destination);
  const tocar = () => {
    tocarTrim(audio, compressor, 0, 0.9);
    tocarTrim(audio, compressor, 1, 0.9);
  };
  void audio.resume().catch(() => {});
  tocar();
  const timer = window.setInterval(tocar, 3000);
  return () => { window.clearInterval(timer); void audio.close().catch(() => {}); };
}

export type SomDoTelefone = "atendeu" | "desligou" | "perdida";

/** Sons curtos de um toque só: atendeu (sobe), desligou (desce) e perdida (três notas descendo, mais graves). */
export function tocarSom(som: SomDoTelefone) {
  let ctx: AudioContext;
  try { ctx = new AudioContext(); } catch { return; }
  const notas: Record<SomDoTelefone, Nota[]> = {
    atendeu: [{ freq: SI5, inicio: 0, duracao: 0.12 }, { freq: MI6, inicio: 0.1, duracao: 0.22 }],
    desligou: [{ freq: MI6, inicio: 0, duracao: 0.12 }, { freq: SI5, inicio: 0.1, duracao: 0.12 }, { freq: SI4, inicio: 0.2, duracao: 0.25 }],
    perdida: [{ freq: SI5, inicio: 0, duracao: 0.15, ganho: 0.09 }, { freq: SOL_SUST5, inicio: 0.15, duracao: 0.15, ganho: 0.09 }, { freq: SI4, inicio: 0.3, duracao: 0.35, ganho: 0.09 }],
  };
  tocarNotas(ctx, notas[som]);
  window.setTimeout(() => void ctx.close().catch(() => {}), 1200);
}
