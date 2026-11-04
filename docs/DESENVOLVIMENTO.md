# Ambiente de desenvolvimento em tempo real

Preview na rede: **http://192.168.1.133:5180**.

Entre com a conta normal do Chat Interno. O aviso verde identifica o ambiente. O preview usa os mesmos arquivos React/CSS do desktop, com Vite HMR: salvar alterações em `src/` atualiza a tela automaticamente, sem gerar instalador. Os serviços e as operações continuam sendo os corporativos reais.

O processo `acessa-workspace-live` está registrado no PM2. Comandos no servidor:

```bash
pm2 logs acessa-workspace-live --lines 30
pm2 restart acessa-workspace-live
pm2 stop acessa-workspace-live
```

Para iniciar manualmente, com a porta livre:

```bash
cd /home/noc/acessa-workspace-desktop
npm run dev:live
```

O preview ocupa somente a porta 5180. Não substitui o Apache nem reinicia o chat, agendas ou dashboard. O Vite encaminha HTTP e WebSocket por destinos corporativos fixos, evitando dependência de CORS e de acesso direto do computador de teste à porta 5000. O proxy da agenda usa o certificado público já autorizado no desktop e continua verificando sua identidade e cadeia TLS.

## Verificar o dashboard

No app, abra **Dashboard → Diagnóstico da conexão**. Confira o servidor, ambiente, transporte (no desktop), última leitura dos indicadores, base de clientes e último erro. O endereço esperado é `http://192.168.1.133:5000`. O app 0.5.12 converte automaticamente o endereço antigo da página (`http://192.168.1.133`, inclusive porta 80 e barra final).

No preview, [o estado do servidor](http://192.168.1.133:5180/__workspace/status) mostra a conexão real, contagem agregada e horários dos eventos. Esse diagnóstico não inclui credenciais nem nomes de clientes. A base de clientes pode aguardar o próximo ciclo de três minutos.

Desde a versão 0.5.13, o desktop corporativo consulta `/api/integrations/dashboard` no Chat Interno, com a sessão do usuário, por HTTP a cada cinco segundos. O computador não precisa mais alcançar a porta 5000: essa conexão é local ao servidor. O diagnóstico mostra o Chat Interno como destino e a porta 5000 como fonte. Servidores de dashboard personalizados continuam com Socket.IO direto. O teste no servidor não substitui a confirmação no computador do usuário.

## Desenvolver no Electron

Em uma sessão gráfica do computador de desenvolvimento:

```bash
npm run dev
```

Alterações de React/CSS são aplicadas por HMR. Alterações em `electron/`, incluindo main e preload, são recompiladas e reiniciam o Electron automaticamente. O perfil de desenvolvimento fica em `.workspace-dev/profile/`, separado do aplicativo instalado e ignorado pelo Git. A janela de teste usa Vite em `127.0.0.1:5178`; o preview de rede continua em 5180.

O `--no-sandbox` foi usado apenas na tela virtual Linux durante a verificação. Não é necessário acrescentá-lo em um Windows normal.

## Evidências de 21/10/2026

- Testes do dashboard: oito testes de interface passaram.
- Testes unitários/de integração e TypeScript passaram.
- O preview recebeu indicadores do servidor real via proxy.
- Um endereço salvo como página antiga foi migrado para a porta 5000.
- Alterar e restaurar um texto atualizou o navegador sem recarga completa, preservando o estado JavaScript.
- Alterar e restaurar um comentário no processo principal trocou o PID do Electron automaticamente.
- Autenticação dos testes automatizados usou fixtures isoladas; nenhuma conta de produção foi usada.

[Relatório do preview](live-preview.json) e [captura de tela](live-preview.png).

Para repetir o teste do preview, deixe-o ativo e mantenha as portas de fixture 14179–14182 livres:

```bash
node scripts/verify-live-preview.mjs
```

O script troca temporariamente um texto do banner para comprovar HMR e restaura o arquivo ao terminar.
