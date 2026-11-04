# Contratos utilizados

Todas as URLs configuradas são origens, sem caminho. O desktop acrescenta `/api`. O token do Chat Interno é enviado por `Authorization: Bearer …` nas chamadas e em `auth: {token}` no socket. Nenhuma credencial SGP ou MariaDB é exigida do cliente.

## Chat Interno

| Método e caminho                                 | Uso                                                                     |
| ------------------------------------------------ | ----------------------------------------------------------------------- |
| `POST /api/login`                                | `{email, senha}` → `{token, user}`                                      |
| `GET /api/me`                                    | Identidade verificada, empresa, setor e `perfil`                        |
| `GET /api/me/quick-access`                       | `{available, selected}` para visibilidade das ferramentas e agendas     |
| `GET /api/chat/conversas-diretas`                | Conversas e `nao_lidas`                                                 |
| `GET /api/chat/grupos`                           | Array ou `{grupos}`, `tem_acesso`, `unreadCount/nao_lidas`              |
| `GET /api/chat/usuarios`                         | Contatos e presença                                                     |
| `GET /api/chat/conversa-direta/:usuario_id`      | Histórico, `conversa_id`, mensagem fixada, limite e paginação originais |
| `GET /api/chat/grupo/:grupo_id`                  | Histórico do grupo                                                      |
| `GET /api/chat/grupo/:grupo_id/membros`          | Participantes                                                           |
| `POST /api/chat/enviar-direto`                   | Contrato original com `usuario_id`, mensagem, tipo e anexos             |
| `POST /api/chat/enviar-grupo`                    | Contrato original de grupos                                             |
| `POST /api/chat/upload`                          | Multipart, campo `arquivo`; preserva limite de 750 MiB do backend       |
| `PATCH /api/chat/favoritos`                      | `{tipo, referencia_id, favorito}`                                       |
| `DELETE /api/chat/conversas-diretas/:id/ocultar` | Ocultar conversa para o usuário                                         |

Os componentes migrados também mantêm as rotas originais de edição/exclusão, stickers, compartilhados, aparência, favoritos, reações e fixação em `/api/messages/*`, `/api/chat/stickers/*` e `/api/chat/appearance/*`. O inventário extraído do frontend está em `frontend-api-inventory.json`.

**Eventos globais:** `user_connect`, `join_user_groups`, `receive_direct_message`, `new_direct_message_notification`, `receive_group_message`, `user_status_changed`, `direct_message_status`, `group_message_status`, `message_updated`, `message_deleted` e atualização de grupos. Após reconexão, a identidade e as salas são sincronizadas e o cache é invalidado.

**Conversas:** os componentes originais preservam `join_direct_chat`, `leave_direct_chat`, `mark_conversa_read`, `join_group`, `leave_group`, `mark_group_read`, eventos de envio, digitação, status, reações e fixação. A cópia migrada condiciona leitura à conversa visível e ao foco da janela.

Notificações direta e de sala referentes à mesma mensagem são deduplicadas. Os contadores são recalculados pelas respostas das APIs; há atualização periódica para convergir mesmo se algum evento não chegar. As notificações desta versão são mantidas em memória durante a sessão, sem simular um histórico durável do servidor.

## Agendas

| Serviço     | REST de leitura utilizado                                                |
| ----------- | ------------------------------------------------------------------------ |
| Ambos       | `GET /api/technician-absences?date=YYYY-MM-DD`                           |
| Manutenção  | `GET /api/agenda-tecnicos/tecnicos`                                      |
| Manutenção  | `GET /api/agenda-tecnicos/almocos?data=YYYY-MM-DD`                       |
| Manutenção  | `GET /api/agenda-tecnicos/tecnicos-sgp` para capacidade de transferência |
| Instalações | `GET /api/agenda-tecnicos-instalacao/almocos?data=YYYY-MM-DD`            |

**Eventos:** cliente emite `filtrarData` com uma string `YYYY-MM-DD`. Manutenção responde com um array em `agenda` ou `agendaAtualizada`; também pode emitir `agendaSemAlteracao` e `agendaErro`. Instalações responde com `{date, items}` em `agenda`. O cliente rejeita uma resposta de instalações com data diferente da solicitada. Cada data usa uma conexão própria, pois o servidor mantém uma data ativa por socket. A visualização de sete dias assina sete datas e consulta seus almoços/ausências.

**Campos:** `id/idOrdemServico`, `tecnico`, `cliente`, `hora`, `status`, `motivo`, `bairro`, `enderecoCompleto`, `latitude`, `longitude`, `turnoHorario` e responsável SGP são preservados quando retornados.

**Transferência:** `POST /api/agenda-tecnicos/ordens-servico/:osId/tecnico-responsavel`, com `{tecnicoDestino, tecnicoAnterior, responsavelAnteriorSgp, data}`. O backend existente resolve o usuário SGP e utiliza `os_tecnico_responsavel` em `/api/os/update/id/`. O desktop não chama o SGP diretamente. A transferência exige perfil administrativo verificado, confirmação do usuário, gateway habilitado e `podeTrocarTecnico: true`.

`agendaOsTecnicoAlterado` atualiza a agenda e gera uma notificação interna com link para `/agenda?os=…&data=…`. Ao abrir, o cliente seleciona a data e os detalhes da OS retornada pelo serviço.

## Dashboard

Origem Socket.IO configurável. Emite `request_update` ao conectar e periodicamente. Recebe `update` com `{grupos: Record<string, number>}`. Somente valores numéricos finitos enviados pelo servidor são exibidos. Conexão interrompida e última atualização ficam explícitas.

## Alterações de contrato

Nenhuma alteração foi feita nos endpoints existentes. O gateway opcional publica uma lista limitada das mesmas rotas, verifica identidade pelo Chat Interno e traduz o perfil verificado para os cabeçalhos exigidos pelo legado. Ele não modifica a tradução SGP nem o armazenamento dos serviços.

A autenticação independente da Intranet (`/auth/login`, `{username,password}`) foi identificada, mas não existe federação pronta com o chat. Não enviamos o token do chat a esse backend como se fossem equivalentes.
