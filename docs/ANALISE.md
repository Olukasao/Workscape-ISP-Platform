# Análise dos projetos existentes

Complemento em 19/10/2026: a fonte do Dashboard operacional foi identificada em `/var/www/html`. O frontend é HTML/JavaScript e o backend publica `update` (grupos, contagens, pedidosAbertos, emAndamento) e `clientes` por Socket.IO. A versão 0.2.0 porta essas regras e telas para React local; consulte [INTEGRACAO-LOCAL.md](INTEGRACAO-LOCAL.md). A análise de 14/10 abaixo registra a versão anterior.

Análise realizada em 14/10/2026, antes da implementação. Os diretórios originais foram consultados, sem gravações.

| Projeto      | Origem                                 | Tecnologias e estrutura                                                                                                                    | Contratos relevantes                                                                                                |
| ------------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Chat Interno | `/home/noc/chat-interno`               | Frontend React/JS, Vite, CSS Modules, Axios, Lucide, Socket.IO; backend Express, JWT, MariaDB, multer/sharp                                | `/api/login`, `/api/me`, conversas, grupos, anexos, stickers, reações, favoritos, fixação, ferramentas e permissões |
| Intranet     | `/home/noc/intranet`                   | React/TS, Vite; Express, JWT, bcrypt, banco no servidor                                                                                    | `/auth/login` recebe `username/password`; `/auth/me`; `/users` retorna um placeholder                               |
| Manutenção   | `/home/noc/agenda-tecnicos`            | HTML/JS imperativo em `api/public/index.html`; Node/Express/Socket.IO; serviços SGP, horários, almoços, ausências, localização e auditoria | Eventos `filtrarData`, `agenda`, `agendaAtualizada`; REST `/api/agenda-tecnicos/*`                                  |
| Instalações  | `/home/noc/agenda-tecnicos-instalacao` | HTML/JS em `page/index.html`; Express/Socket.IO HTTPS e integração SGP no servidor                                                         | `agenda: {date, items}`; ausências e almoços em REST                                                                |

O dashboard de `/home/noc/intranet/front/src/pages/Dashboard.tsx` contém números e atividades fixos. Eles não foram usados como indicadores reais. O backend da Intranet tem autenticação diferente da do chat e não oferece API de indicadores funcionais. Não é correto tratar seu JWT como intercambiável com o JWT do chat.

O chat também integra um dashboard operacional real via Socket.IO (`request_update` → `update`, com `grupos`). O novo módulo utiliza esse contrato com origem configurável. Nenhuma credencial MariaDB, SGP, rastreamento, SMTP ou chave TLS foi copiada dos backends para o novo aplicativo.

## Arquitetura implementada

```text
Renderer React local
  ├─ sessão/identidade via Chat Interno
  ├─ Zustand: sessão ativa, preferências e notificações
  ├─ TanStack Query: cache por usuário e sincronização das APIs
  ├─ Socket.IO global: chat, presença e reconexão
  ├─ módulos de agenda: assinatura por data
  └─ preload: operações desktop explicitamente enumeradas
       └─ main Electron: validação de origem/payload, HTTP, downloads,
          safeStorage, janela, bandeja e notificações
Serviços corporativos continuam no servidor
  └─ gateway opcional: valida identidade antes de acessar agendas legadas
```

O frontend é carregado de `app://workspace`, com arquivos compilados incluídos no pacote. Não há iframe ou webview para carregar os três sistemas. As mensagens usam os componentes originais `MensagensDiretas` e `MensagensGrupo`, com o cliente de API e o socket adaptados.

As requisições HTTP do Electron passam pelo main, que resolve um serviço configurado e um caminho `/api/*`. O renderer não recebe acesso genérico a `fetch` privilegiado, sistema de arquivos, shell ou `ipcRenderer`. Redirecionamentos HTTP são recusados. A CSP permite apenas o código local e os serviços configurados; anexos relativos `/uploads/*` são resolvidos pelo protocolo local. Downloads usam diálogo nativo e só aceitam arquivos do servidor do chat.

No modo navegador de desenvolvimento, o Axios usa CORS normal. O modo Electron usa o transporte IPC e não exige liberar CORS indiscriminadamente no servidor. Socket.IO utiliza WebSocket, preservando autenticação e reconexão; servidores precisam permitir o upgrade na configuração do proxy.

## Riscos encontrados nos originais

- Algumas rotas das agendas não autenticam a sessão e aceitam perfil por cabeçalho; a ausência do cabeçalho pode conceder privilégio administrativo.
- A agenda de instalações contém credenciais de integração no código do servidor. Elas não foram copiadas; recomenda-se movê-las para configuração protegida no servidor e avaliar sua rotação separadamente.
- A autenticação da Intranet é independente e não há endpoint de troca de sessão/SSO entre ela e o chat.
- Alguns componentes antigos dependem de domínios e recursos externos, identidade visual própria ou APIs específicas. Os que não foram adaptados constam na matriz de migração.

Nenhuma correção desses serviços foi implantada em produção. A compatibilidade é mantida no cliente e no gateway opcional, sem alteração de esquema de banco ou do contrato SGP.
