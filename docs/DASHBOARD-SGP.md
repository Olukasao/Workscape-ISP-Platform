# Integração do dashboard SGP — 0.5.11

O Painel NOC do Workspace usa a interface React local e os dados do serviço já existente em `http://192.168.1.133:5000`. Não incorpora a página do Apache nem faz login diretamente no SGP.

## Fluxo conferido em 21/10/2026

`SGP → /var/www/html/server.js (PM2: dashboard) → Socket.IO → processo principal Electron → IPC → estado compartilhado → Painel NOC e Resumo`

Na visualização web de desenvolvimento, o cliente Socket.IO conversa diretamente com o mesmo serviço. No desktop, a origem vem da configuração validada do processo principal. Nenhuma credencial do SGP é necessária no aplicativo.

O servidor publica `update` ao conectar e quando as contagens mudam. O evento contém `total`, `grupos`, `contagens`, `emAndamento`, `pedidosAbertos` e `atualizado`. A consulta de chamados em andamento ocorre a cada 60 segundos; instalações e consulta completa de ocorrências, a cada 120 segundos. Os intervalos dependem também do tempo das requisições e das novas tentativas do servidor.

O evento `clientes` é publicado no ciclo de 180 segundos, após as consultas por situação. Ele não é reenviado ao conectar e o backend não implementa `request_update`. Por isso o primeiro acesso pode aguardar o próximo ciclo. A reconexão não força nova consulta ao SGP.

## Implementação

- `src/services/dashboardModel.ts`: interpreta datas em milissegundos e ISO, preserva o total da fonte e os estados de falha das consultas de chamados e instalações.
- `src/services/dashboard.ts`: guarda a última resposta com origem e usuário, aceita apenas o cache correspondente e mantém os horários da fonte. Caches antigos sem identificação são descartados na leitura.
- `electron/dashboardFeed.ts`: conexão única, fallback de WebSocket para polling, reentrega dos últimos eventos na mesma conexão e limpeza ao parar/trocar origem. Não envia eventos que o backend não implementa.
- `src/modules/Dashboard.tsx` e `DashboardResumido.tsx`: total de ocorrências, horários corretos, avisos de falha do SGP e espera explícita pela base de clientes. A visão completa também oferece reconexão manual.

## Validação

Resultado: 67 testes unitários/de integração do aplicativo, 2 testes de distribuição e 8 testes de interface passaram. Build TypeScript/React/Electron e auditorias de empacotamento aprovados. O Electron real em Linux com tela virtual também passou contra o socket corporativo, recebendo 874 ocorrências e 33.482 clientes e abrindo detalhes e visão completa sem erros de interface. A autenticação do teste foi local e isolada; nenhuma conta de produção foi usada. Evidências: [relatório](dashboard-desktop-0.5.11.json) e [captura de tela](dashboard-desktop-0.5.11.png).

Conexão real com Socket.IO e interpretação dos dois eventos verificadas. Uma das leituras retornou 871 ocorrências, 8 chamados em andamento e 6 instalações. A base recebida em 21/10/2026 às 10:52:33, no horário de Brasília, retornou 33.482 clientes, 8.062 ativos, 0 reduzidos, 208 suspensos e 25.586 cancelados. São leituras transitórias, não constantes do aplicativo. Os filtros são consultados separadamente pelo backend; o aplicativo preserva as contagens da fonte.

Comandos de verificação:

```bash
npm test
node --test deploy/updates/tests/distribution.test.mjs
npm run test:e2e -- --grep 'Dashboard React|chamado do Dashboard|Painel NOC'
npm run build
node scripts/verify-dashboard-desktop.mjs
```

O Vitest executa as suítes do aplicativo e gateway; a suíte de distribuição usa o runner `node:test` separadamente. Os testes de interface cobrem navegação local, conexão compartilhada, fallback, cache por usuário/origem, avisos de falha e datas numéricas de produção.

Para verificar o Electron real contra o dashboard corporativo, mantendo login e perfil de teste isolados:

```bash
node scripts/verify-dashboard-desktop.mjs --live
```

Esse comando é somente de leitura no serviço corporativo; aguarda o ciclo de clientes, valida resumo, detalhes e visão completa e grava evidências em `docs/dashboard-desktop-0.5.11.*`. Precisa de acesso à rede corporativa, sessão gráfica (ou Xvfb no Linux) e portas locais 14179–14182 livres. No Linux usa `--no-sandbox` apenas para o teste. O aplicativo mantém seu isolamento normal.

## Pendências no serviço original

O backend original permanece sem alterações nesta entrega:

- O delta envia `data_cadastro_inicio` em ISO com horário, mas o SGP exige `AAAA-MM-DD` e retorna HTTP 400. A consulta completa continua funcionando.
- Há timeouts de consultas ao SGP, tratados por novas tentativas no servidor.
- `server.js` contém credenciais e está acessível via Apache. É necessário bloquear a exposição, mover as credenciais para fora da pasta pública e rotacioná-las. A entrega do desktop não resolve essa exposição no servidor.
- Fornecedores, itens em estoque e equipamentos críticos ainda não têm integração.

O instalador Windows gerado localmente não possui assinatura Authenticode e precisa de homologação no Windows. Não foi publicado no canal de atualizações por esta tarefa.
