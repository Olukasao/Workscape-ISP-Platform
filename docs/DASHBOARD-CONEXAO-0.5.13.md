# Dashboard no desktop — 0.5.13

O usuário reportou `websocket error · socket hang up · ECONNRESET` no Windows, enquanto o preview HTML funcionava. O preview utiliza um proxy no servidor; o desktop tentava conectar diretamente à porta 5000. O teste anterior em Linux não reproduziu a condição do computador do usuário.

## Mudança

`SGP → dashboard:5000 → relay local no Chat Interno → GET /api/integrations/dashboard com JWT → Electron net.fetch (Chromium) → Painel NOC`

No desktop com dashboard corporativo padrão, não há mais tentativa de WebSocket ou HTTP direto para a porta 5000 no computador do usuário. A consulta HTTP utiliza a origem do chat já configurada e a sessão normal do usuário, a cada cinco segundos, sem sobreposição de requisições. O botão de reconexão também usa esse caminho. Origens de dashboard personalizadas conservam a integração Socket.IO.

O relay mantém uma conexão local por long-polling, recebe `update` e `clientes` e guarda a última resposta. Novos acessos recebem a base já conhecida, sem esperar outro ciclo do SGP. O endpoint exige o middleware de autenticação existente, verifica o usuário no banco e retorna `Cache-Control: no-store`. Não recebe nem distribui credenciais SGP.

Arquivos no serviço do Chat Interno:

- `backend/src/services/dashboardRelayService.js`: conexão, cache e registro da rota autenticada.
- `backend/src/Routes/Routes.js`: registro com o middleware real.
- `backend/src/server.js`: início da conexão local.
- `backend/test/dashboardRelay.test.js`: autenticação, conexão compartilhada, cache e perda de conexão.

O serviço `chat-interno` foi reiniciado para ativar a rota. Requisições sem autenticação retornam HTTP 401 tanto na porta 8600 quanto pelo proxy do preview. Nenhum banco nem registro de clientes foi alterado para testar esta funcionalidade.

## Verificações

```bash
cd /home/noc/chat-interno/backend
node --test test/dashboardRelay.test.js

cd /home/noc/acessa-workspace-desktop
npm run typecheck
npm test
npm run test:e2e -- --grep 'desktop corporativo|Painel NOC|Dashboard React|chamado do Dashboard'
npm run build
DISPLAY=:122 node scripts/verify-dashboard-desktop.mjs --live
```

O teste de interface força erro `ECONNRESET` caso o transporte direto seja chamado e verifica que os dados chegam pela API autenticada sem iniciar esse transporte. O teste Electron usa a rede Chromium de verdade, autenticação de fixture isolada e upstream real do dashboard; não usa uma conta de produção. Relatórios e capturas são gravados por versão em `docs/dashboard-desktop-0.5.13.*`.

A confirmação final na máquina Windows onde ocorreu o erro continua necessária. O instalador local não é publicado automaticamente pelo comando de empacotamento.

Resultado da execução: build e auditorias passaram; 67 testes do aplicativo, nove de interface e o teste do relay passaram. O teste Electron real em Linux recebeu 855 ocorrências e 33.482 clientes pelo HTTP autenticado via Chromium, abriu detalhes e visão completa e terminou sem erros de interface. O teste de relay também confirmou reconexão automática depois da perda da conexão local. Consulte [o relatório](dashboard-desktop-0.5.13.json).
