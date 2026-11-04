# Módulo Cursos (LMS) do Acessa Workspace

Universidade corporativa dentro do app. Aba **Cursos** (`/cursos/*`); o item **Marketing** foi criado junto, ainda vazio.

## Onde está cada parte

| Parte | Local |
| --- | --- |
| Telas do aluno e administração | `src/modules/cursos/` (`admin/` para gestão) |
| API (Express) | `chat-interno/backend/src/Routes/cursosRoutes.js`, montada em `/api/cursos` |
| Regras de negócio puras (provas, bloqueios, certificado, pontos) | `chat-interno/backend/src/services/cursosLogic.js` |
| Tabelas (todas `cursos_*`) | `chat-interno/backend/migrations/20261023_create_cursos_lms.sql` |
| Testes | `backend/src/services/cursosLogic.test.js` (unitário) e `backend/test/cursos.integration.test.js` |

Usa a autenticação do Chat Interno (JWT), `usuarios`, `setores` e `perfil = admin`. Nenhum outro módulo foi alterado; só duas linhas em `Routes.js` registram a rota.

## Como funciona

- **Tabelas** são criadas sozinhas na primeira chamada à API (`CREATE TABLE IF NOT EXISTS`, mesmo padrão da roleta). Nada é apagado ou alterado nas tabelas existentes.
- **Permissões**: administradores do sistema gerenciam cursos; podem liberar outras pessoas em *Gerenciar > Permissões* (`cursos_gestores`). Todas as rotas `/admin/*` conferem isso no servidor.
- **Conteúdo**: cada aula é uma lista de blocos validada no servidor (tipos permitidos, links só `http(s)`, vídeos só YouTube/Vimeo). Nada vira HTML: o texto usa uma marcação mínima (`**negrito**`, `*itálico*`, `__sublinhado__`, `` `código` ``, `[link](https://...)`) renderizada por componentes React.
- **Provas**: sorteio, correção, limite de tentativas e cronômetro são do servidor. O aluno nunca recebe o gabarito antes do momento configurado (`final`, `imediato` por questão, ou `nunca`). Discursivas ficam *aguardando correção* até o gestor dar a nota.
- **Progresso**: gravado no servidor (aula concluída, posição de leitura, última aula). O tempo estudado só sobe em passos de até 120 s por chamada.
- **Certificado**: emitido automaticamente ao concluir todas as aulas e atingir a média mínima. Código `ACN-XXXX-XXXX-XXXX`; a verificação pública (`/api/cursos/verificar/<código>`) mostra só nome abreviado, curso e data. O PDF é gerado no app (SVG com QR Code → imagem → PDF).
- **Arquivos**: ficam em `uploads/cursos/<ano>/`. Só entram imagens, PDF, MP4/WebM, MP3/OGG/WAV, TXT/CSV, ZIP e Office; o servidor confere os primeiros bytes (não basta a extensão). SVG e HTML são recusados. O acesso é por link assinado por usuário (vale 4 h).
- **Auditoria**: criação, edição, publicação, exclusão, matrícula e correção entram em `cursos_auditoria`.

## Limitações conhecidas

- O CSP do app mantém `frame-src 'none'` (exigido pela auditoria do build). Por isso vídeos do YouTube/Vimeo e PDFs abrem na janela externa; vídeos MP4 enviados tocam dentro do app.
- Ainda não há banco de questões reutilizáveis entre provas, nem integração com as Notificações existentes.
- Envio de arquivos pelo app passa o arquivo inteiro pelo IPC do Electron: para vídeos grandes prefira o link do YouTube/Vimeo.

## Testes

```bash
cd chat-interno/backend
node --test src/services/cursosLogic.test.js                 # regras puras
# integração: precisa de um MariaDB descartável (nunca o de produção)
LMS_TEST_DB=127.0.0.1:3399 node --test test/cursos.integration.test.js
```

O teste de integração cria `empresas/setores/usuarios` mínimos no banco informado (`lms_test`).
