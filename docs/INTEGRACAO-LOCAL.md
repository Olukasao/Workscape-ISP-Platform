# Acessa Workspace 0.2.0: integração local

Atualização 0.2.1: a agenda de instalação foi removida do app, da Home e do Dashboard por solicitação do usuário. A agenda de técnicos usa a origem corporativa e o certificado conferido do servidor. O registro da versão anterior abaixo é histórico; consulte [AGENDA-0.2.1.md](AGENDA-0.2.1.md) para o estado atual.

Correção em 19/10/2026 no projeto `/home/noc/acessa-workspace-desktop`. O código antigo de `/home/noc/intranet`, os três sistemas originais e os serviços de produção foram preservados.

## Problema corrigido

O Electron já carregava `app://workspace/index.html`, e o chat e a visualização de agenda já tinham componentes locais. Porém, `/dashboard` renderizava a Home, o código do monitoramento ainda continha uma implementação antiga com agendas em iframe, quatro ferramentas de operação não tinham rotas ativas e o preload expunha `openExternal` para domínios dos serviços.

Agora o Dashboard é um módulo React próprio, os três módulos principais não abrem sites e não incorporam páginas. O main não importa `shell` nem oferece IPC de abertura externa. Links antigos conhecidos são convertidos em rotas internas tanto no renderer quanto no main. Páginas desconhecidas e destinos externos continuam bloqueados, sem inventar substitutos para recursos ausentes.

## Auditoria das fontes

| Sistema | Fonte | Contrato e destino |
| --- | --- | --- |
| Chat Interno | `/home/noc/chat-interno/frontend/src` | React/JS, Socket.IO, Axios. Componentes de mensagens diretas/grupos já migrados em `src/legacy/components/Chat`; módulo `src/modules/Chat.jsx`. Autenticação central existente por `/api/login` e `/api/me`. |
| Dashboard | `/var/www/html/index.html` e `server.js` | Frontend HTML/JS imperativo; Express 5.2.1 e Socket.IO 4.8.3 no servidor. Regras do frontend portadas para `dashboardModel.ts`; telas em `Dashboard.tsx`. O backend não é distribuído. |
| Agenda | `/home/noc/agenda-tecnicos/api/public` | HTML/JS imperativo, Express/Socket.IO, SGP e Rastrea.me no servidor. Preservados o módulo React local e os adaptadores de agenda existentes. A agenda original também contém uma integração de instalação mais recente; não foi substituída nem declarada integralmente portada nesta correção. |
| Ferramentas de rede | `chat-interno/frontend/src/pages` | Componentes reais de conectividade, perda de pacotes, diagnóstico de clientes e controle operacional ativados em rotas locais com o cliente API compartilhado. |

O inventário com tamanhos e hashes está em `local-integration-inventory.json`. O mapa real de campos do Dashboard foi extraído para `tests/fixtures/dashboard-source-fields.json`, fora do instalador. Um teste exige que todos os 31 campos tenham destino no módulo novo. A autenticação e os backends são os que já existiam; não foram criados tokens intercambiáveis nem credenciais de produção no instalador. O Dashboard usa seu contrato de leitura Socket.IO e não recebe o JWT do chat.

## Matriz da correção

| Funcionalidade original | Destino e comportamento |
| --- | --- |
| Base de clientes e distribuição por situação | `clientes` alimenta total, atualmente, ativos, reduzidos, suspensos e cancelados. Campo ainda não recebido aparece como `—`. |
| Suporte, prioridade, rede, campo, massivos | Todos os campos do mapa original, inclusive aliases sem acento e nomes antigos. |
| Comercial, financeiro, órgãos, almoxarifado | Indicadores reais do evento `update`; vendas em execução respeitam a precedência `pedidosAbertos`/`contagens`. |
| Situação da rede | Mesmos limiares do código original: Offline >25 para atenção; Offline >60 ou soma DAS/MRT/SRP >5 para crítico. PV/LRJ continuam nos indicadores, sem alterar a regra global. |
| Cores dos indicadores | Regras originais de 20/30 e retenção 3/5. |
| Chamados em andamento | Detalhes de `emAndamento.chamados`, dados desatualizados indicados e navegação para OS/data da agenda React. |
| Visão resumida e detalhada | Mesmos dados React; sem carregar `antigo.html`. Filtro e modo preservados ao trocar de módulo. |
| Resumos de agenda | Dados do adaptador Socket.IO em componentes React, sem carregar HTML das agendas. |
| Ferramentas de diagnóstico | Importação local sob demanda; permissões de `/me/quick-access` e validação final nas APIs. Perda de pacote usa a permissão original `teste-conectividade-sites`. |
| Links antigos de Chat/Agenda/Dashboard | Resolvidos para `/chat`, `/agenda`, `/instalacao` e `/dashboard`. Tokens e redirecionamentos antigos não são copiados. |
| Home e Dashboard | Uma conexão compartilhada do Dashboard por sessão; navegação não recria o socket. Dados e estado são limpos na saída. |

Os relatórios que existiam apenas como links para o SGP não foram transformados em páginas fictícias. O serviço do Dashboard disponibiliza contadores e chamados em execução; não oferece listagem detalhada de cada categoria. A integração completa desses relatórios requer um contrato de API apropriado.

## Execução e serviços

```bash
cd /home/noc/acessa-workspace-desktop
npm run dev
# ou executar a versão compilada:
npm start
```

Configure as **origens dos serviços backend** em Configurações. O Dashboard usa a origem de Socket.IO, historicamente na porta 5000, não a página HTML na porta 80. A interface é distribuída dentro do aplicativo. Serviços de autenticação, banco, mensagens, SGP e rastreamento continuam centrais. Não é necessário servir os frontends antigos para executar os módulos migrados.

Nenhuma alteração de produção, banco ou implantação foi feita. Escritas de agenda continuam exigindo gateway autenticado conforme `GATEWAY.md`. As preferências de conexão existentes foram preservadas.

## Verificação

- `npm test`: regras do Dashboard, cobertura do mapa original, destinos de navegação e segurança IPC/gateway.
- `npm run test:e2e`: fluxos com APIs/sockets locais e frontends antigos respondendo HTTP 503. Testes não desligam nenhum sistema real.
- `npm run test:desktop`: Electron real em Linux carregando o build empacotado pelo protocolo local, com APIs/sockets isolados.
- `npm run build`: TypeScript, Vite, Electron, auditoria de segredos e auditoria de integração local.
- `npm run audit:integration`: confirma os dez módulos necessários nos chunks reais de produção, a ausência de iframe/webview/abertura externa nos três módulos principais e a política do Electron.

`dist/local-integration.json` registra quais arquivos reais compõem cada chunk; `docs/local-integration-build.json` registra o resultado da auditoria. `docs/dashboard-backend-contract.json` registra uma observação somente de leitura do evento do backend real na porta 5000, sem armazenar valores ou detalhes pessoais dos chamados.

## Limites

Esta correção elimina os atalhos dos módulos integrados e amplia o Dashboard local. Não conclui as pendências anteriores de mapas/rastreamento, edição completa de almoço/ausências/turnos, recursos avançados do chat e integração de todos os relatórios SGP. Consulte `MIGRACAO.md`. A Wiki mantém seu visualizador de documentos; não é usado para incorporar nenhum dos três sistemas e continua sujeito à CSP que proíbe frames no Electron.

Os fluxos de produção com contas reais e a instalação/desinstalação em Windows ainda exigem homologação. Os executáveis gerados neste Linux não têm assinatura Authenticode; a edição de recursos PE depende do build Windows já configurado no workflow.

## Distribuição gerada

- Instalador Windows x64: `release/AcessaWorkspace-Setup.exe`.
- Portátil Windows x64: `release/AcessaWorkspace-Portable.exe`.
- Fontes atualizadas: `release/Acessa-Workspace-Desktop-Source.zip`.
- Integridade: `release/SHA256SUMS.txt` e `release/delivery-manifest.json`.

Os três artefatos correspondem à versão 0.2.0. O conteúdo compilado do ASAR foi conferido contra o build testado em Electron Linux. A execução dos instaladores no Windows ainda está pendente. A versão anterior foi preservada em `/home/noc/backups/acessa-workspace-release-0.1.0`.
