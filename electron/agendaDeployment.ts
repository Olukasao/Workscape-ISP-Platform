// Origem corporativa informada para o Chat Interno. HTTP permitido somente
// para este endereço e serviço, sem habilitar HTTP legado globalmente.
export const chatOrigin = "http://192.168.1.133:8600";
export const agendaOrigin = "https://192.168.1.133:8500";
// Public certificate identity verified against agenda-tecnicos/api/cert.pem.
// No private key, passwords or SGP credentials are distributed.
export const agendaCertificateSha256 =
  "0B14FF0C00E3B1979FEFFE91CD40FE37CBF05F7280BC777FAF2702696C40FC39";
// Painel NOC corporativo (/var/www/html/server.js). Só leitura: o Socket.IO
// entrega contagens agregadas e não recebe token nem credenciais. O serviço
// existe apenas em HTTP na rede interna, por isso esta origem é fixada.
export const dashboardOrigin = "http://192.168.1.133:5000";
