# Marketing > Site (dados do site no Workspace)

Fluxo: **Workspace → Chat Interno → site (Hostinger)**. O token do site nunca chega ao app.

| Parte | Local |
| --- | --- |
| API no site | `acessanet-lab/server/src/routes/marketingFeedRoutes.ts` e `analytics/marketingStats.ts` (`GET /api/integracoes/marketing/resumo?period=today|7d|30d|90d|custom`) |
| Ponte no chat | `chat-interno/backend/src/Routes/marketingRoutes.js` e `services/marketingSiteService.js` (`GET /api/marketing/site/resumo`) |
| Tela | `src/modules/marketing/SiteDashboard.tsx` |

## Segurança
- A rota do site só existe se `MARKETING_FEED_TOKEN` estiver definido no `.env` do site; exige `Authorization: Bearer <token>` (comparação em tempo constante).
- Devolve só números e rótulos agregados (nenhum nome, CPF, e-mail ou telefone).
- No chat, só `admin` e `admin_comercial` consultam; o token fica no `.env` do chat (`MARKETING_FEED_TOKEN`; a URL sai de `CONTRATACOES_FEED_URL`, ou defina `MARKETING_FEED_URL`).
- Cache de 30 s no site e no chat; período máximo de 366 dias.

## Para ativar em produção
1. O **mesmo** valor de `MARKETING_FEED_TOKEN` (já gerado no `.env` do chat) vai para o `.env` do site na Hostinger.
2. Publicar o site (`acessanet-lab/deploy-hostinger.sh`) e reiniciar o chat (`pm2 restart chat-interno`).
3. Gerar e publicar o Workspace 0.5.35.

## O que é medido
Clientes e acessos da Central do Cliente, sessões, contas criadas, chamados abertos pelo site, contratações online, pedidos de plano, visitantes e sessões do Wi-Fi público, candidaturas e relatos de problema. **Visitas anônimas ao site institucional não são medidas** (não há coleta hoje).
