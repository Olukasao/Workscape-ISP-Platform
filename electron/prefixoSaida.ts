/**
 * Prefixo de saída da central: número externo (8+ dígitos, só dígitos, sem 0 na frente) sai com "0" para todo mundo.
 * Ramais e filas (poucos dígitos), códigos com * ou #, números internacionais (+) e quem já digitou o 0 ficam como estão.
 * Arquivo puro, sem dependências: usado pelo processo principal (discagem) e pela tela (aviso "já vem com 0").
 */
export const PREFIXO_SAIDA = "0";
export function numeroDeSaida(numero: string): string {
  return /^[1-9][0-9]{7,}$/.test(numero) ? PREFIXO_SAIDA + numero : numero;
}
