# Gateway opcional de compatibilidade

Este componente é para o **servidor corporativo**. Não é incluído no `.exe` e não precisa ser executado na máquina de cada funcionário. Sua implantação não foi realizada.

Ele corrige a fronteira de acesso do novo cliente sem alterar os serviços legados: autentica cada chamada e assinatura Socket.IO pelo `/api/me` do Chat Interno, verifica o acesso à agenda em `/api/me/quick-access` para usuários comuns e permite transferência somente a `perfil: admin`.

Cabeçalhos `x-user-role`, `x-user-id` enviados por clientes não são usados como identidade. O gateway gera esses campos a partir da identidade consultada no chat. Rotas não publicadas recebem 404; eventos de escrita legados não são encaminhados. Somente `filtrarData` é aceito do cliente via socket.

## Preparação

```bash
cd gateway
npm install
```

Configure no ambiente do processo:

```text
CHAT_ORIGIN=https://chat.empresa.com.br
AGENDA_ORIGIN=https://agenda-legada.empresa.com.br
INSTALLATION_ORIGIN=https://instalacao-legada.empresa.com.br
GATEWAY_HOST=127.0.0.1
AGENDA_GATEWAY_PORT=9410
INSTALLATION_GATEWAY_PORT=9411
```

```bash
npm start
```

Nenhuma senha de banco, chave JWT, token administrativo fixo ou credencial SGP é necessária. A identidade é verificada pelo backend existente a cada requisição; falhas de validação são recusadas. A sessão do socket é revalidada a cada solicitação de data, emitida periodicamente pelo desktop.

## Implantação

Publique os dois listeners por um proxy HTTPS corporativo com suporte a WebSocket. Mantenha o bind local ou uma rede privada. Restrinja acesso direto aos serviços legados na rede; deixar suas portas públicas contorna a proteção do gateway. Confie nos certificados dos upstreams, sem desativar a validação TLS.

Depois, configure as URLs públicas dos gateways como origens de manutenção e instalação no desktop e habilite a opção de gateway autenticado. O Chat Interno continua usando sua origem atual.

## Escopo

O gateway permite leitura de técnicos, horários semanais, cores, ausências e almoços; o único endpoint de escrita publicado é a transferência de técnico da OS de manutenção. Cadastro/alteração de ausência, almoço, turno, rota e instalação continuam pendentes de adaptação e de regras de autorização específicas. Uma opção do cliente não autoriza essas operações no gateway.

## Validação local

Cinco testes automatizados cobrem sessão ausente, rotas não publicadas, tentativa de forjar perfil, transferência administrativa, capacidade de escrita para usuário comum e autenticação/encaminhamento Socket.IO. Esses testes usam upstreams locais artificiais e não realizam mudanças no SGP.
