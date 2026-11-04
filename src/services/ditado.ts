import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";

export type EstadoDitado = "parado" | "gravando" | "transcrevendo";
const MAX_SEGUNDOS = 75;

const tipoSuportado = () => ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"].find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t));

/** O navegador deste computador consegue gravar áudio? */
export const ditadoDisponivel = () => typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

function paraBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error("Não consegui ler o áudio."));
    leitor.onload = () => resolve(String(leitor.result).split(",")[1] || "");
    leitor.readAsDataURL(blob);
  });
}

/** Mensagem clara para cada motivo de o microfone não abrir. */
function erroDoMicrofone(e: unknown) {
  const nome = (e as { name?: string })?.name;
  if (nome === "NotAllowedError" || nome === "SecurityError") return "O Windows bloqueou o microfone para este app. Libere em Configurações > Privacidade > Microfone.";
  if (nome === "NotFoundError" || nome === "OverconstrainedError") return "Não encontrei um microfone neste computador.";
  if (nome === "NotReadableError") return "O microfone está sendo usado por outro programa.";
  return "Não foi possível usar o microfone.";
}

/**
 * Ditado por voz: grava no microfone e devolve o texto falado (a transcrição é feita no servidor pela IA).
 * Chame `alternar()` para começar e de novo para terminar. A gravação para sozinha em 75 segundos.
 */
export function useDitado({ aoTexto }: { aoTexto: (texto: string) => void }) {
  const [estado, setEstado] = useState<EstadoDitado>("parado");
  const [segundos, setSegundos] = useState(0);
  const [erro, setErro] = useState("");
  const gravador = useRef<MediaRecorder | null>(null);
  const fluxo = useRef<MediaStream | null>(null);
  const pedacos = useRef<Blob[]>([]);
  const relogio = useRef<number>(0);
  const cancelado = useRef(false);
  const aoTextoRef = useRef(aoTexto);
  aoTextoRef.current = aoTexto;

  const soltarMicrofone = useCallback(() => {
    window.clearInterval(relogio.current);
    fluxo.current?.getTracks().forEach((t) => t.stop());
    fluxo.current = null;
  }, []);

  const transcrever = useCallback(async (blob: Blob) => {
    setEstado("transcrevendo");
    try {
      const audio = await paraBase64(blob);
      const { data } = await api.post<{ texto: string }>("/ia/assistente/transcrever", { audio, mime: blob.type }, { timeout: 90000 });
      if (data.texto) aoTextoRef.current(data.texto);
      else setErro("Não ouvi nada. Fale perto do microfone e tente de novo.");
    } catch (e) {
      setErro((e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Não foi possível transcrever agora. Tente de novo.");
    } finally {
      setEstado("parado");
    }
  }, []);

  const parar = useCallback(() => {
    if (gravador.current?.state === "recording") gravador.current.stop();
  }, []);

  const comecar = useCallback(async () => {
    setErro("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      fluxo.current = stream;
      const tipo = tipoSuportado();
      const g = new MediaRecorder(stream, tipo ? { mimeType: tipo } : undefined);
      pedacos.current = [];
      cancelado.current = false;
      g.ondataavailable = (e) => { if (e.data.size) pedacos.current.push(e.data); };
      g.onstop = () => {
        soltarMicrofone();
        const blob = new Blob(pedacos.current, { type: g.mimeType || tipo || "audio/webm" });
        if (cancelado.current) { setEstado("parado"); return; }
        if (blob.size < 800) { setErro("Não ouvi nada. Fale perto do microfone e tente de novo."); setEstado("parado"); return; }
        void transcrever(blob);
      };
      gravador.current = g;
      g.start();
      setSegundos(0);
      setEstado("gravando");
      relogio.current = window.setInterval(() => {
        setSegundos((s) => {
          if (s + 1 >= MAX_SEGUNDOS) parar();
          return s + 1;
        });
      }, 1000);
    } catch (e) {
      soltarMicrofone();
      setErro(erroDoMicrofone(e));
      setEstado("parado");
    }
  }, [parar, soltarMicrofone, transcrever]);

  const alternar = useCallback(() => {
    if (estado === "parado") void comecar();
    else if (estado === "gravando") parar();
  }, [estado, comecar, parar]);

  const cancelar = useCallback(() => {
    cancelado.current = true;
    parar();
  }, [parar]);

  // Sair da tela com o microfone aberto nunca pode deixá-lo ligado.
  useEffect(() => () => { cancelado.current = true; if (gravador.current?.state === "recording") gravador.current.stop(); soltarMicrofone(); }, [soltarMicrofone]);

  return { estado, segundos, erro, limparErro: () => setErro(""), alternar, cancelar };
}
