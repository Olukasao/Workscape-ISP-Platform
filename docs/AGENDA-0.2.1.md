# Agenda de Técnicos — correção 0.2.1

Em 19/10/2026, a conexão foi validada com o servidor real em `https://192.168.1.133:8500`. O Electron recebeu a lista de 14 técnicos e renderizou 67 atendimentos na data da verificação. Nenhum dado foi substituído por uma lista estática e nenhuma alteração de chamados ou de produção foi realizada.

## Causa e correção

O servidor existente apresenta um certificado autoassinado cujo nome não corresponde ao endereço IP. O Workspace anterior usava a validação pública padrão e não reconhecia esse certificado.

O novo aplicativo reconhece somente a impressão SHA-256 do certificado público conferido diretamente em `agenda-tecnicos/api/cert.pem`, restrita ao endereço corporativo e ao período de validade. Certificados de outros servidores e certificados vencidos não recebem essa confiança adicional. Nenhuma chave privada foi copiada e não há desativação global de TLS.

A verificação está em `electron/agendaTrust.ts`, com a identidade pública em `electron/agendaDeployment.ts`. As requisições HTTP da agenda pelo IPC agora usam `net.fetch`, compartilhando a política de certificado da sessão Electron com o WebSocket do renderer. Referência: [verificação de certificados e transporte da sessão Electron](https://www.electronjs.org/docs/latest/api/session#sessetcertificateverifyprocproc).

A origem real já vem configurada. Configurações antigas com agenda vazia, o exemplo de configuração ou o endereço HTTP conhecido são migradas para HTTPS. Origens personalizadas válidas, como um gateway corporativo, são preservadas.

Não é necessário habilitar HTTP legado para esta agenda. O computador precisa alcançar a rede interna da empresa. Quando o certificado corporativo for renovado, sua nova identidade deverá ser verificada no servidor e atualizada no código; o aplicativo não aceita automaticamente um certificado desconhecido.

## Agenda de instalação removida

Foram removidos:

- Item da barra lateral e a montagem do módulo.
- Resumo de instalações do Dashboard.
- Indicador e próximos atendimentos de instalação da Home.
- Campo de servidor nas configurações.
- Serviço `instalacao` do schema, do cliente HTTP e da API IPC.
- Resolução dos links antigos da porta 8501.
- Notificações destinadas à agenda de instalação.

Configurações salvas antigas deixam de incluir o serviço ao serem lidas. As antigas rotas React de instalação redirecionam para o início. Nenhuma conexão é feita ao backend de instalação. Os contadores operacionais do NOC relativos à atividade comercial/instalações continuam como indicadores do Dashboard; eles não carregam uma agenda.

O sistema original de instalação e a funcionalidade do servidor de agenda não foram alterados ou desligados.

## Validação

`docs/agenda-live-0.2.1.json` registra o teste real em Electron: HTTP 200, socket WSS, técnicos e chamados renderizados. O login do teste usa uma identidade isolada local; somente a agenda foi consultada em produção. O relatório guarda contagens, sem nomes, endereços ou detalhes pessoais.

Os testes de certificado verificam identidade, origem, datas e recusa de outro certificado. Os testes de interface incluem a ausência do módulo em Home/Dashboard/configurações, o redirecionamento da rota antiga e zero requisições/sockets ao servidor de instalação. Os demais fluxos de chat e agenda são cobertos pela regressão existente.

O instalador atualizado fica em `release/AcessaWorkspace-Setup.exe`. Use a versão 0.2.1 para aplicar a correção. A instalação/desinstalação em Windows ainda requer homologação; os testes de execução ocorreram em Electron Linux.

Cópia identificada pela versão: `release/AcessaWorkspace-0.2.1-Setup.exe`. Os executáveis anteriores foram preservados em `/home/noc/backups/acessa-workspace-release-0.2.0`.
