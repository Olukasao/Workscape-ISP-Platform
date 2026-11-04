import { useEffect, useRef } from "react";
import { useSession } from "../stores/workspace";
import { useTelefone } from "../stores/telefone";
import { iniciarTelefone, pararTelefone, registrarHistorico, usePhone } from "../stores/phone";
import { iniciarToque, tocarSom } from "../services/toque";

/** Sem tela: liga o telefone ao entrar no Workspace, grava o histórico e toca quando alguém liga. */
export default function TelefoneMotor() {
  const token = useSession((s) => s.token);
  const userId = useSession((s) => s.user?.id);
  const abrir = useTelefone((s) => s.abrir);
  const tocando = usePhone((s) => s.snapshot.chamadas.some((c) => c.direcao === "in" && c.estado === "tocando"));
  // Abre o cartão quando a conversa começa ou quando a pessoa liga (pelo chat, por exemplo). Chamada tocando mostra só a faixa.
  const emChamada = usePhone((s) => s.snapshot.chamadas.some((c) => c.estado === "conversando" || (c.direcao === "out" && c.estado === "chamando")));

  useEffect(() => {
    if (token && userId) void iniciarTelefone(token, (e) => {
      if (e.type === "history") {
        void registrarHistorico(e);
        // Perdida avisada com som, mas nunca no Não perturbe (a ligação foi recusada de propósito).
        if (e.direcao === "in" && e.resultado === "nao_atendida" && !e.silenciosa) tocarSom("perdida");
      }
      if (e.type === "abrir") abrir();
    });
    else void pararTelefone();
  }, [token, userId, abrir]);

  useEffect(() => { if (tocando) return iniciarToque(); }, [tocando]);
  // Sons de começo e fim da conversa. Só tocam quando a conversa realmente começou: chamada recusada ou perdida não faz "desligou".
  const conversando = usePhone((s) => s.snapshot.chamadas.some((c) => c.estado === "conversando"));
  const jaConversou = useRef(false);
  useEffect(() => {
    if (conversando && !jaConversou.current) { jaConversou.current = true; tocarSom("atendeu"); }
    else if (!conversando && jaConversou.current) { jaConversou.current = false; tocarSom("desligou"); }
  }, [conversando]);
  // O cartão do telefone abre sozinho quando há uma ligação em andamento (por exemplo, iniciada pelo chat).
  useEffect(() => { if (emChamada) abrir(); }, [emChamada, abrir]);
  return null;
}
