# Instalação e operação

## Usuário Windows

Use `AcessaWorkspace-Setup.exe` para instalar ou `AcessaWorkspace-Portable.exe` para abrir sem instalar. Ambos devem ser executados por um usuário comum. O runtime Electron já inclui Node/Chromium; o usuário final não precisa instalar ferramentas de desenvolvimento.

Na primeira abertura, informe os servidores em **Configurar conexão** e entre com a conta do Chat Interno. Uma origem tem formato `https://servidor:porta`, sem `/api`. As portas encontradas nos fontes foram: chat HTTP 8600, manutenção HTTPS 8500, instalação HTTPS 8501 e dashboard Socket.IO 5000. Esses valores são referências da análise, não configuração automática ou garantia da publicação atual.

A conexão às agendas legadas exige que seu certificado seja confiável no dispositivo. Instale a cadeia corporativa pelo procedimento da empresa ou publique os serviços atrás de HTTPS confiável. O aplicativo não aceita certificados inválidos silenciosamente.

Fechar a janela envia para a bandeja por padrão. Para encerrar de fato, use **Sair** no menu da bandeja. Desative esse comportamento em Configurações se preferir encerrar ao fechar. Eventos continuam chegando enquanto houver conexão, o processo estiver em execução e o computador não estiver suspenso.

A opção de iniciar com Windows utiliza o caminho da instalação atual. Na versão portátil, mover ou remover o executável pode invalidar a entrada de inicialização.

## Dados locais

Electron usa `app.getPath('userData')`; no Windows, normalmente fica sob `%APPDATA%\Acessa Workspace`. Contém URLs/preferências e, somente quando solicitado e suportado, `session.enc` criptografado pelo sistema. Não copie esse token entre contas ou máquinas. Sair encerra a sessão local e remove o token lembrado. O servidor continua sendo a autoridade da autenticação.

## Build no Windows

```powershell
npm ci
npm run build
npm run dist:win
```

Os arquivos ficam em `release`. O workflow `.github/workflows/windows.yml` realiza instalação de dependências, testes e build em um runner Windows. Ele está preparado, mas não foi enviado a um repositório nem executado no GitHub nesta sessão.

Para assinatura corporativa, configure os mecanismos de assinatura do Electron Builder por segredo protegido no CI. Não inclua certificados privados, senhas ou tokens no código/repositório.

## Build em Linux

O script detecta o build cruzado e desativa a edição PE. O instalador NSIS padrão tentou executar Wine para preparar o desinstalador, mas este ambiente não o suporta. A alternativa em `assets/installer-linux.nsi` compila instalador e desinstalador em uma passagem, instala por usuário, cria atalhos e registro de desinstalação, e preserva os dados do aplicativo em APPDATA. A versão portátil utiliza o target padrão do Electron Builder.

Esse fallback é escolhido somente no Linux. No Windows, `npm run dist:win` mantém o instalador padrão do Electron Builder. Ambos ainda precisam de homologação de instalação/desinstalação no Windows. Não use arquivos intermediários deixados por builds que falharam.

## Problemas de conexão

- Login: verifique a origem do Chat Interno e a disponibilidade de `/api/login`.
- Agenda não conecta: confira porta, cadeia TLS e upgrade WebSocket no proxy.
- Indicador “—”: o serviço ainda não respondeu; não representa valor zero.
- Transferência bloqueada: exige gateway autenticado, perfil `admin` e capacidade retornada pelo backend.
- Toast ausente: confira as permissões de notificações do Windows e se o processo continua na bandeja. A validação visual do toast ainda precisa ser feita no Windows.
- Modo navegador: depende do CORS dos serviços. Use `npm run dev` para testar o transporte IPC real do desktop.

Referências técnicas: [segurança do Electron](https://www.electronjs.org/docs/latest/tutorial/security), [safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage) e [distribuição Windows do Electron Builder](https://www.electron.build/win/).
