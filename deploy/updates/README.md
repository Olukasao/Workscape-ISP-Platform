# Atualizações do Acessa Workspace

Pasta exclusiva: `/home/noc/acessa-workspace-updates`.

- `incoming/`: recebimento privado dos arquivos gerados no build.
- `public/windows/pilot/`: primeiras máquinas de homologação.
- `public/windows/stable/`: distribuição aos funcionários.
- `scripts/`: publicação validada e servidor HTTPS.
- `config/`: instruções e exemplo de serviço. Nunca colocar certificados privados em `public/`.

## Situação inicial

A pasta foi criada, mas ainda não existe canal HTTPS em funcionamento nem certificado de assinatura de executáveis configurado. Nenhuma versão está anunciada em `latest.yml`. Um instalador sem canal aparece como “ainda não configurado pela TI” e não executa downloads de atualização.

São duas configurações diferentes:

1. **HTTPS do servidor**: a TI escolhe um nome/endereço e um certificado TLS confiável nos computadores. O endereço do feed termina em `/windows/stable/` (ou `/windows/pilot/`). Não usar o HTTP do chat como feed.
2. **Assinatura dos executáveis**: certificado de assinatura de código Windows da empresa, com o nome do publicador correspondente. As credenciais ficam no CI Windows; nunca são distribuídas aos usuários.

## Subir o servidor depois de configurar TLS

Requer Node.js 24. Instalar as dependências com `npm ci` nesta pasta.

```bash
UPDATES_TLS_CERT=/caminho/privado/certificado.pem \
UPDATES_TLS_KEY=/caminho/privado/chave.pem \
UPDATES_BIND=192.168.1.133 \
UPDATES_PORT=8643 \
node scripts/server.mjs
```

Os caminhos dos certificados acima devem ser substituídos pela TI. A porta deve ser verificada/liberada na rede. O servidor só atende GET/HEAD para manifestos, instaladores e blockmaps dos canais permitidos. Não serve código-fonte, `incoming/`, certificados, listagem de pastas ou upload de arquivos. O endpoint suporta Range para downloads diferenciais.

O endereço definitivo e a identidade do publicador precisam ser informados no build do aplicativo. Somente criar a pasta não habilita atualização nos executáveis antigos.

## Gerar a versão oficial no Windows

No repositório do aplicativo, configurar no ambiente seguro:

- `WORKSPACE_UPDATE_URL`: URL HTTPS completa do canal, terminando em `/windows/stable/`.
- `WORKSPACE_UPDATE_PUBLISHER`: nome exato do publicador no certificado Authenticode; preferir seu DN completo.
- `WIN_CSC_LINK`: certificado/credencial de assinatura aceito pelo electron-builder.
- `WIN_CSC_KEY_PASSWORD`: senha, quando aplicável.

Executar `npm ci` e `npm run dist:win:release`. O build oficial recusa canal HTTP, credenciais incompletas e pacote sem assinatura. Para homologação, usar o endereço de `pilot/` no build correspondente. Manter as versões de cada canal crescentes.

## Publicar

Transferir exclusivamente os três arquivos produzidos pela mesma execução assinada:

- `latest.yml`;
- `AcessaWorkspace-VERSAO-Setup.exe`;
- `AcessaWorkspace-VERSAO-Setup.exe.blockmap`.

Exemplo (substituir a pasta pelo pacote real):

```bash
node scripts/publish.mjs incoming/0.5.1 pilot
# Após homologação, publicar o pacote aprovado no canal estável:
node scripts/publish.mjs incoming/0.5.1 stable
```

O script valida versão, nomes e SHA-512; mantém arquivos versionados imutáveis; recusa downgrade; publica `latest.yml` por último, com troca atômica. A autenticidade do executável é verificada no CI e novamente por cada aplicativo Windows antes da instalação. O operador de publicação deve aceitar somente artefatos do CI autorizado.

Não substituir o conteúdo de uma versão publicada. Para corrigir uma entrega, gerar uma versão superior. Em caso de falha no processo de publicação, o manifesto anterior permanece em uso. Um `.publish.lock` remanescente só deve ser removido depois de confirmar que não há publicação em execução.

## Funcionamento nos computadores

Instalar a primeira versão com suporte ao atualizador. Downloads posteriores ocorrem em segundo plano. A instalação é silenciosa na saída real pelo menu da bandeja ou na próxima abertura, antes de carregar a interface, após nova validação do canal e do pacote. Fechar a janela para a bandeja não interrompe o trabalho. A versão portátil não usa este mecanismo.

Não iniciar instalação durante desligamento/logoff. Se faltar rede, assinatura válida ou acesso ao canal, a versão instalada continua utilizável. Uma atualização não pode ocorrer com envio/download em andamento quando acionada pelo botão de reinício.
