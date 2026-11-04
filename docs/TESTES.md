# Resultados dos testes e limites da entrega

## Versão 0.2.1 — correção da agenda

- Build/TypeScript/auditorias: aprovados.
- Vitest: 46 testes aprovados em cinco arquivos, incluindo confiança do certificado, validade, origem e migração de configurações.
- Playwright: 13 fluxos aprovados; confirmado que a agenda de instalação está ausente da Home, Dashboard, configurações e navegação, com zero chamadas e sockets para seu serviço.
- Electron Linux: regressão aprovada para chat, Dashboard, agenda, IPC, upload/download e bandeja.
- Agenda real: HTTP 200 e WSS; 14 técnicos recebidos e 67 atendimentos renderizados, sem escrita em produção e sem guardar dados pessoais. Relatório em `agenda-live-0.2.1.json`.
- ASAR 0.2.1: 80 arquivos compilados idênticos ao build verificado.

Relatório consolidado em `test-summary.json`; detalhes em [AGENDA-0.2.1.md](AGENDA-0.2.1.md). Instalação/desinstalação em Windows ainda não homologadas.


## Versão 0.2.0 — 19/10/2026

- TypeScript, build de produção e auditorias de segredos/integração: aprovados.
- Vitest: 42 testes aprovados em quatro arquivos.
- Playwright: 12 fluxos aprovados, incluindo Dashboard, links legados, conectividade, perda de pacotes e pesquisa de cliente, com frontends antigos desligados nas fixtures. Relatório: `e2e-0.2.0.json`.
- Electron real em Linux: aprovado com Dashboard local, navegação legada interceptada no main, ausência de API de abertura externa, chat, agenda, IPC, upload/download e recepção em segundo plano. Relatório: `desktop-test.json`.
- ASAR Windows: versão 0.2.0; 80 arquivos compilados conferidos por SHA-256 contra o build testado. Relatório: `packaged-integration-0.2.0.json`.
- Preservação das fontes: 198 arquivos dos três projetos originais conferidos por hash, todos inalterados.
- Backend real do NOC: evento Socket.IO observado somente para confirmar o contrato; nenhuma escrita e nenhum detalhe pessoal de chamados armazenado.

A validação funcional foi feita com serviços locais de teste. Ela não substitui homologação com contas reais nem instalação em Windows. Os limites do sandbox Linux e da assinatura/edição PE descritos abaixo continuam aplicáveis. As capturas com nome `preview-dashboard-*.png` são exclusivamente de teste.

## Registro da versão 0.1.0


Esta versão foi compilada e executada em Linux. Os serviços usados nos testes automatizados são fixtures isoladas, derivadas dos contratos encontrados nos fontes. **Não foi realizado login com uma conta corporativa real, nem alteração de OS, banco ou serviço de produção.**

## Resultados executados

| Verificação | Resultado | Evidência |
| --- | --- | --- |
| Instalação das dependências do desktop e do gateway | Concluída | `package-lock.json` e `gateway/package-lock.json` |
| TypeScript e compilação de produção | Aprovados | `npm run build`, também executado dentro de `npm run dist:win` |
| Políticas IPC e gateway | 11 testes aprovados | `tests/policy.test.ts` e `tests/gateway.test.mjs` |
| Interface no navegador | 8 testes aprovados | `tests/workspace.e2e.ts`; última execução: `8 passed` |
| Electron real com frontend compilado | Aprovado, 15 grupos de verificações | `desktop-test.json` e `scripts/smoke-electron.mjs` |
| Inicialização do fluxo de desenvolvimento | Aprovada | `dev-test.json`: Vite + Electron, React sob CSP com nonce |
| Auditoria por padrões de segredos | Aprovada | `scripts/audit-build.mjs`; não prova ausência de todo segredo possível |
| Conteúdo do ASAR final | Aprovado | `package-audit.json`: sem backends, testes, gateway, node_modules, SQL ou chaves |
| Comparação adicional com credencial literal encontrada no servidor original | Nenhuma ocorrência no ASAR | `known-secret-audit.json`; valores não são registrados |
| Dependências de runtime | Zero vulnerabilidades reportadas no snapshot | `npm-audit-runtime.json` |
| Dependências do gateway | Zero vulnerabilidades reportadas no snapshot | `npm-audit-gateway.json` |
| Dependências incluindo ferramentas de build | 8 vulnerabilidades moderadas no snapshot | `npm-audit-all.json`, cadeia transitiva de ferramentas de build; fora do ASAR |
| Instalador Windows | Gerado | `release/AcessaWorkspace-Setup.exe` |
| Portátil Windows | Gerado | `release/AcessaWorkspace-Portable.exe` |
| Estrutura dos executáveis e checksums | Conferidos | `binaries.json` e `release/SHA256SUMS.txt` |

Os launchers NSIS são PE32 e incluem o aplicativo Electron **x64**, cujo executável tem máquina PE `0x8664`. O formato do launcher não significa que o aplicativo seja de 32 bits. Nenhum dos três executáveis contém certificado Authenticode.

## Cobertura da interface

- Login e indicadores vindos das respostas dos serviços locais.
- Navegação entre módulos, filtros da agenda, visualização de sete dias e redimensionamento.
- Histórico de mensagens diretas e de grupos nos componentes originais.
- Envio de mensagem e preservação de rascunho ao navegar para a agenda e voltar.
- Mensagem recebida em segundo plano sem marcar leitura indevidamente.
- Deduplicação de eventos de notificação e abertura da conversa correspondente.
- Reconexão do Socket.IO e reassociação de identidade/grupos.
- Ausência de rede, tema persistente e logout com limpeza de token.
- Resposta 401, visibilidade das ferramentas por permissões e validação de URL.
- Abertura com servidor indisponível: preservação da sessão e recuperação por nova tentativa.

## Cobertura do Electron

O teste real verifica protocolo `app://workspace`, autenticação HTTP pelo IPC, preferências de isolamento, ausência de `require` no renderer, recusa de destinos IPC não autorizados, recusa de escritas nas agendas sem gateway, chat e agenda renderizados, redimensionamento, fechamento para bandeja e recepção de mensagem enquanto oculto. Verifica ainda upload multipart, download com validação de origem e diálogo nativo substituído apenas no teste, proxy local de anexos e bloqueio de popups externos.

O harness Linux utiliza uma tela virtual e `--no-sandbox` devido às limitações do ambiente. As preferências de produção observadas incluem `sandbox: true`, mas esse teste **não comprova o sandbox do sistema operacional** quando o argumento de teste está presente. Context isolation, ausência de Node no renderer e validações IPC foram exercitados. O argumento não faz parte dos executáveis distribuídos.

## Empacotamento Windows

O build padrão NSIS inicialmente falhou por ausência de Wine funcional. Foi implementado e compilado um fallback em `assets/installer-linux.nsi`: instalador por usuário, seleção de diretório, atalhos, registro de desinstalação e desinstalador gerado sem executar Windows durante o build. O script `dist:win` seleciona esse fallback no Linux e mantém o instalador padrão no Windows.

A compressão LZMA do fallback excedeu o timeout do compilador neste ambiente; a configuração final usa zlib. O build final gerou instalador de aproximadamente 151 MiB e portátil de aproximadamente 115 MiB. Os hashes exatos estão no manifesto.

**Instalação, execução e desinstalação em Windows ainda não foram testadas.** A edição de recursos PE do executável principal foi desativada no build cruzado; o workflow Windows está preparado para a compilação padrão com ícone/metadados completos. Não foi executado no GitHub.

## O que ainda precisa de homologação

- Login real, cargos/permissões e compatibilidade dos serviços publicados.
- Toasts, clique em notificação, badge e inicialização automática no Windows.
- Armazenamento seguro de sessão na conta Windows do usuário.
- Fluxos avançados de mensagens: stickers animados, gravação, reações, fixação, paginação e anexos grandes.
- Administração original e operações reais de compra/conteúdo.
- Transferência de técnico no SGP e implantação do gateway no servidor.
- Funcionalidades ainda não portadas descritas em [MIGRACAO.md](MIGRACAO.md).

As capturas `preview-*.png` mostram exclusivamente dados identificados como testes. Elas não representam a operação corporativa real.
