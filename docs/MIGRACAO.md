# Estado da migração

Atualização 0.2.1: a agenda de instalação foi removida do app, da Home e do Dashboard por solicitação do usuário. A agenda de técnicos usa a origem corporativa e o certificado conferido do servidor. O registro da versão anterior abaixo é histórico; consulte [AGENDA-0.2.1.md](AGENDA-0.2.1.md) para o estado atual.

Atualização 0.2.0: o Dashboard real de `/var/www/html` foi portado para React, com os 31 campos do mapa original, regras de alerta, base de clientes e chamados em execução. Diagnóstico de clientes, conectividade, perda de pacotes e controle operacional agora têm rotas locais. O preload deixou de oferecer abertura externa. Detalhes e limites em [INTEGRACAO-LOCAL.md](INTEGRACAO-LOCAL.md). As pendências abaixo continuam válidas exceto os recursos expressamente atualizados.

Esta entrega é uma primeira versão funcional. A presença do código original em `src/legacy/` não significa que todos os seus recursos já foram integrados ou homologados.

| Área                  | Implementado                                                                                                                                                          | Validação realizada                                                                                               |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Shell                 | Navegação React local, sidebar recolhível, temas, janela personalizada, layout redimensionável                                                                        | Playwright e Electron Linux                                                                                       |
| Autenticação          | Login compatível com Chat Interno, `/me`, expiração, logout e token lembrado via armazenamento seguro quando disponível                                               | Login/401/logout em serviços locais; proteção do renderer em Electron                                             |
| Permissões            | Recursos do catálogo por `/me/quick-access`, administração por perfil verificado, acesso a grupos pelo contrato original                                              | Catálogo e restrições em fixtures; gateway com usuário comum e administrador                                      |
| Início                | Contatos online, não lidas, agendamentos e instalações retornados pelos serviços                                                                                      | Respostas contratuais locais, sem indicadores estáticos de produção                                               |
| Dashboard | 31 campos do Dashboard real de /var/www/html, clientes, regras de alerta, vendas em execução e detalhes SGP; componentes React locais | Regras e mapa de origem em Vitest; fluxos Playwright/Electron; contrato real observado somente em leitura |
| Chat direto           | Lista, pessoas, histórico, envio, rascunho preservado ao trocar de módulo e sincronização em segundo plano                                                            | Playwright e Electron com backend local                                                                           |
| Grupos                | Listagem e histórico nos componentes originais; envio, membros e recursos originais presentes                                                                         | Histórico exercitado; envio e gestão completa ainda precisam de homologação                                       |
| Mensagens avançadas   | Componentes originais de anexos, imagens, áudio, emojis, stickers, reações, fixação, favoritos, busca, edição/exclusão, resposta, paginação e arquivos compartilhados | Compilação; multipart/download exercitados no IPC. Demais interações não tiveram cobertura ponta a ponta completa |
| Sincronização         | Socket global, reassociação de identidade/grupos na reconexão, atualização de listas, invalidação de cache e deduplicação de notificações                             | Reconexão forçada e eventos duplicados exercitados                                                                |
| Leitura               | Mensagens em módulo oculto ou janela sem foco não são marcadas como lidas pela cópia migrada                                                                          | Evento recebido com agenda aberta exercitado                                                                      |
| Notificações          | Central de sessão, contadores, integração nativa, clique abre conversa; eventos de transferência abrem OS quando disponíveis                                          | Central e navegação exercitadas; toast e clique reais do Windows pendentes                                        |
| Agenda de manutenção  | Dia/7 dias, busca por cliente/OS/bairro, filtro por técnico, status, horário, turno quando enviado, almoço, ausências, endereço, coordenadas e detalhes               | Leitura/filtros/semana/redimensionamento em fixtures; Electron lê agenda                                          |
| Agenda de instalações | Dia/7 dias, busca, técnico, status, almoço, ausências e detalhes                                                                                                      | Fixture com formato `{date, items}`                                                                               |
| Transferência de OS   | Arrastar/soltar ou seletor, confirmação, contrato original de responsável SGP; bloqueada inicialmente                                                                 | Gateway testado com upstream local; nenhuma transferência no SGP executada                                        |
| Estado | Chat e agendas preservam estado existente; filtro e modo do Dashboard ficam em estado seletivo da sessão; socket do NOC compartilhado | Rascunho, filtros e alternância entre módulos exercitados; não há nova conexão NOC ao alternar Home/Dashboard |
| Desktop               | Minimizar, maximizar/restaurar, bandeja/menu/sair, processo único, contador, inicialização opcional no Windows, preferências                                          | Electron Linux: bandeja, redimensionamento e recepção em segundo plano; recursos específicos de Windows pendentes |
| Distribuição          | Builder Windows x64 NSIS/portable, assets locais, workflow Windows                                                                                                    | Consultar resultado final de empacotamento em TESTES.md                                                           |

## Ferramentas originais acessíveis

Os componentes React foram copiados para o novo projeto e conectados à API, sessão e tema compartilhados. São carregados sob demanda, conforme acesso:

- Notas rápidas e compartilhamento.
- Wiki/base de conhecimento e seus cursos.
- Pesquisa global.
- Calculadoras de internet dedicada, semidedicado, troca de plano e acordos.
- Materiais de vendas.
- Solicitações internas e solicitações/compras.
- Boas práticas e dúvidas.
- Textos de atendimento/procedimentos financeiros.
- Plantão de domingo.
- Administração original, histórico do chat, permissões de compras, banner e avisos administrativos.

Essas ferramentas tiveram verificação de compilação. Apenas visibilidade do catálogo foi exercitada em Playwright; operações administrativas e alterações reais de dados não foram executadas. Algumas páginas mantêm estilos originais e ainda precisam de refinamento visual para alcançar a consistência completa da nova shell.

## Pendências explícitas

1. Homologar login, cargos e permissões com contas reais em ambiente de teste; nenhuma conta foi fornecida nesta sessão.
2. Homologar cada interação avançada do chat, incluindo anexos grandes, stickers animados, gravação de áudio, reações, fixação, exclusão, paginação, atualização de membros e administração. A gravação por microfone ainda é bloqueada pela política de permissões do Electron desta versão.
3. Portar os controles de edição de almoço, ausências, turnos semanais, cores por equipe e coordenadores. A visualização preserva dados recebidos, mas não substitui todos os controles administrativos das páginas HTML originais.
4. Portar mapa interativo, coordenação/sugestão/aplicação de rotas, rastreamento ao vivo, histórico de movimentações e agrupamento de chamados simultâneos. Coordenadas e endereço enviados pelo serviço já aparecem nos detalhes.
5. Integrar os demais recursos do chat/intranet: avisos não administrativos, galeria, assinaturas, roleta, competição, efeitos sonoros e os demais recursos ainda sem rotas locais. Os componentes de diagnóstico de rede e controle operacional foram conectados na versão 0.2.0; sua homologação completa de produção continua pendente. Os originais continuam disponíveis nos projetos anteriores, sem perda ou exclusão de código.
6. Implementar federação com o backend independente da Intranet quando existir contrato SSO. Seu dashboard de números fixos não foi migrado como dado real.
7. Homologar transferência SGP e atualizar as regras de escrita do gateway para perfis/coordenadores adicionais aprovados. Hoje somente `admin` tem transferência.
8. Implantar o gateway/proteção equivalente e restringir acesso direto aos serviços legados. Nada foi implantado.
9. Verificar instalação, desinstalação, ícone/badge da barra de tarefas, inicialização automática e notificações em Windows. Integrar assinatura Authenticode quando houver certificado corporativo.
10. Tratar links fora das origens autorizadas e protocolos como telefonia de forma explícita. A política atual os bloqueia; janelas externas arbitrárias não são abertas.
11. Melhorar persistência de histórico de notificações: hoje a central é limitada a 100 itens em memória por sessão.

Não há simulador de dados no produto. As fixtures e credenciais artificiais de testes não fazem parte do ASAR distribuído.
