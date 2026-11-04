import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useTelefone } from "../stores/telefone";

/** O Telefone não é uma página: quem chegar aqui (busca global, link antigo) abre o card e volta para Ferramentas. */
export default function TelefoneRota() {
  const abrir = useTelefone((s) => s.abrir);
  useEffect(() => abrir(), [abrir]);
  return <Navigate to="/tools" replace />;
}
