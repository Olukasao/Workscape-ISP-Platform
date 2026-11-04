# Workscape Phone, Fase 1: investigação do MicroSIP

Data: 2026-10-27. Alvo: MicroSIP 3.22.16.0, código-fonte oficial (https://www.microsip.org/source, licença GNU GPL v2).

## Método e limites (leia primeiro)

- **Feito:** leitura do código-fonte oficial, que está em C++/MFC (231 arquivos, ~43 mil linhas). Todas as afirmações marcadas **[verificado]** citam arquivo e linha desse código.
- **NÃO feito:** o REA (Reverse Engineer Anything) **não está instalado**. O `npx rea-agents setup` foi bloqueado pela permissão do Claude Code e aguarda o usuário. Por isso **nenhum binário foi analisado**: não analisei `microsip.exe`, nem o PJSIP compilado, nem tráfego de rede. Tudo marcado **[hipótese]** ou **[não verificado]** precisa de observação em ambiente controlado.
- O repositório do MicroSIP **não inclui** as bibliotecas de terceiros (PJSIP, Opus etc.), conforme a página oficial. Só vi o que o MicroSIP faz ao chamar o PJSIP, não o código interno do PJSIP.

## 1. Arquitetura

- Aplicativo Windows em **C++ com MFC**; interface e motor SIP no **mesmo processo**. [verificado: `mainDlg.cpp`]
- Motor SIP: **API C do `pjsua` (PJSIP)**, chamada diretamente (`pjsua_create`, `pjsua_init`, `pjsua_start`, `pjsua_acc_add`, `pjsua_call_*`, `pjsua_conf_*`). [verificado: `mainDlg.cpp:3313`, `:3454`, `:3469`, `:4012`]
- Camadas: `Data/` (repositórios), `Service/` (CallsService, ContactsService), `Domain/` (Call, Contact), `lib/` (jsoncpp, Crypto, Markup, MSIP). [verificado: listagem]
- Os eventos do PJSIP chegam em **threads do PJSIP** e são repassados à interface com `PostMessage` (por exemplo `on_reg_state2` → `UM_ON_REG_STATE2`). [verificado: `mainDlg.cpp:123-141`]
- Inicialização: `pjsua_create` → `pjsua_config_default` → callbacks → STUN/DNS → `pjsua_init` → `pjsua_start` → transportes → conta. [verificado: `mainDlg.cpp:3313-3540`]

## 2. SIP

| Item | Comportamento observado no código | Fonte |
|---|---|---|
| REGISTER | `reg_uri = sip:<servidor>` mais sufixo de transporte; `id = "Display Name" sip:usuario@servidor` | `mainDlg.cpp:4000-4012` |
| Autenticação | Digest, `realm="*"`, senha em texto ou hash digest já calculado | `mainDlg.cpp:3906-3922` |
| Renovação | `reg_timeout = registerRefresh` (configurável); `ka_interval = keepAlive` | `mainDlg.cpp:3829`, `:3848` |
| Proxy | Lista de proxies, cada um `sip:host[:porta]` mais transporte | `mainDlg.cpp:3916-3938` |
| Transportes | UDP (porta de origem configurável, 5060 para conta local), TCP e TLS | `mainDlg.cpp:3493-3540` |
| NAT | STUN (até 8 servidores), `allowRewrite` (Via/SDP/Contact), `public_addr`, ICE por conta | `mainDlg.cpp:3365-3379`, `:3873-3879` |
| Contact | `PJSUA_CONTACT_REWRITE_ALWAYS_UPDATE \| UNREGISTER` | `mainDlg.cpp:3881` |
| Session timer | Pode ser desligado por conta (`PJSUA_SIP_TIMER_INACTIVE`) | `mainDlg.cpp:3844` |
| SRTP | `disabled`, `optional`, `mandatory`, `dtls-sdes`, `dtls`; `srtp_secure_signaling = 0` | `mainDlg.cpp:3850-3871`, `:3359` |
| RTP | Faixa de portas configurável | `mainDlg.cpp:3837-3841` |
| DTMF | Quatro métodos: automático (RFC 2833 e cai para in-band), in-band, RFC 2833, SIP INFO | `global.cpp:618-650` |
| Espera | `pjsua_call_set_hold`; retomar com `pjsua_call_reinvite(..., PJSUA_CALL_UNHOLD)` | `global.cpp:1508-1607` |
| Transferência | `pjsua_call_xfer` (cega) e `pjsua_call_xfer_replaces` (assistida) | `MessagesDlg.cpp:1664`, `:1903` |
| Mensagens e presença | SIMPLE (`on_pager2`, `on_buddy_state`), MWI, PUBLISH | `mainDlg.cpp:3347-3357` |
| Registro 200 | Assina presença e carrega diretório de usuários | `mainDlg.cpp:143-155` |
| Erros de registro | Lê o cabeçalho `P-Registrar-Error` quando o código é ≥ 400 | `mainDlg.cpp:129-138` |

## 3. Áudio

- Eco: `ec_tail_len = 20` (ms) quando ligado e sem Opus estéreo; VAD configurável. [verificado: `mainDlg.cpp:3384-3385`]
- Taxa de amostragem e canais do mixer vêm do maior valor entre os codecs configurados (Opus conta como 24000). [verificado: `mainDlg.cpp:3388-3421`]
- Dispositivos: `pjsua_enum_aud_devs`, `pjsua_set_snd_dev2`, reação a mudanças de dispositivo (`OnDeviceChange`, `CMMNotificationClient`). [verificado]
- Gravação existe (`pjsua_recorder_*`), mas o Workscape Phone **não deve gravar automaticamente**.
- **[não verificado]** perda de pacotes, jitter buffer e PLC: ficam dentro do PJSIP, fora deste código.

## 4. Reconexão

- Ao detectar mudança de rede, o app espera **1 s** (debounce, `IDT_TIMER_NETWORK_CHANGED`) e chama `OnTimerNetworkChange`. [verificado: `mainDlg.cpp:2964-2972`, `:3115-3118`]
- `OnTimerNetworkChange` só age se o motor está rodando, há rede (`IsConnectedToNetworkCOM`) e o IP realmente mudou (`IsNetworkChanged`). Então faz `PortKnock` e, se a opção `networkChanges` estiver ligada, chama **`pjsua_handle_ip_change`** (o PJSIP recria transportes, refaz o registro e re-INVITE das chamadas) e percorre as contas para ajustar o `public_addr`. [verificado: `mainDlg.cpp:2852-2892`] **[não verificado]** o final da função (depois da linha 2892).
- Mudança de dispositivo de áudio: timer `IDT_TIMER_SWITCH_DEVICES` coloca o som em dispositivo nulo, chama `pjmedia_aud_dev_refresh`, reatualiza os IDs e reabre o dispositivo (ringer ou saída). [verificado: `mainDlg.cpp:3119-3146`]
- Se a criação do motor falha por falta de rede, o app mostra um diálogo e oferece tentar de novo. [verificado: `PJCreate`, `mainDlg.cpp:3205-3215`]
- Não vi no MicroSIP um laço próprio de re-registro: a renovação e as novas tentativas ficam com o PJSIP (`reg_timeout`). **[hipótese]**

## 5. Interface e dados

- Presença "ausente" após 120 ciclos de 5 s (10 min) sem teclado ou mouse. [verificado: `mainDlg.cpp:3174-3190`]
- Configuração em arquivo **INI** no perfil Roaming; senhas gravadas cifradas (`IniEncrypt`). [verificado: `settings.cpp:355-359`] **[não verificado]** o algoritmo exato; o `Crypto.cpp` usa a CryptoAPI do Windows com chave derivada de senha.
- Contatos e histórico: bancos locais em `Data/`.

## 6. Estado atual do Workscape (Etapa 2, parcial)

- `electron/microsip.ts` (37 linhas): **só abre o `microsip.exe`** e passa o número como argumento. O comentário diz que a conta é da central VIP Solutions. Saneia o número (dígitos, `+`, `*`, `#`, 2 a 20 caracteres).
- IPC: `microsip:open` em `electron/main.ts:310`, exposto como `openMicroSip` em `electron/preload.ts:84`; `src/services/telefone.ts` e `src/components/TelefoneFlutuante.tsx` (104 linhas) usam isso.
- Electron: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` nas janelas auxiliares e `contextIsolation: true` na principal. Esse padrão precisa ser mantido.
- Backend (chat-interno, Node/Express/MariaDB): **sem nenhuma tabela ou rota de ramais SIP** hoje.

## 7. Licenciamento, o ponto crítico para comercializar

- O MicroSIP é **GPL v2**. Qualquer código copiado dele obriga a abrir o código do derivado.
- O **PJSIP** é, segundo o que conheço, distribuído em **GPL v2 ou licença comercial** (Teluu). **[verificar em pjsip.org/licensing antes de decidir]** Se for assim, embutir PJSIP/PJSUA2 num produto **proprietário e vendido** exige licença comercial, e usar só internamente é uma situação diferente.
- Reimplementar comportamento a partir de protocolos (RFC 3261 etc.) e de observação não copia código. Mas ler o código GPL e reescrever de memória é zona cinzenta; por isso este relatório descreve comportamentos, não trechos.

### Opções de motor SIP

| Opção | Licença | Prós | Contras |
|---|---|---|---|
| PJSUA2 como processo auxiliar | GPL v2 ou comercial | Maduro, igual ao MicroSIP, tem SRTP/TLS/ICE/Opus | Comercializar exige licença comercial |
| baresip/libre como processo auxiliar | BSD-3 | Livre para uso comercial, SIP/RTP/SRTP/TLS nativos, áudio WASAPI | Menos usado no Windows; empacotar e controlar por módulo |
| Pilha SIP própria em Node + áudio nativo | Própria | Controle total | Meses de trabalho: RTP, jitter, eco, codecs; alto risco |
| SIP.js/JsSIP | MIT | Fácil | Exige WebRTC e WSS, que você excluiu, e a central talvez nem aceite |

## 8. Próximos passos que dependem de decisão

1. Autorizar a instalação do REA (comando na conversa) para analisar o binário.
2. Escolher o motor SIP (seção 7).
3. Fornecer **uma conta de teste autorizada** (servidor, domínio, porta, usuário, senha, transporte) da VIP Solutions, que não seja ramal de um funcionário.

## 9. Binário MicroSIP.exe 3.22.16 (análise parcial, NÃO feita com o REA)

Origem: `MicroSIP-3.22.16.zip` de microsip.org, `MicroSIP.exe` com SHA-256 `fe5ad81043e4f755dd8730a520917490787bb66f5ab7ef9e1172d637db8b99dc`. Método: `file` e `strings`. **O REA recusou analisar o executável** (`provider_unavailable`): falta um motor de decompilação (Ghidra, Hopper ou IDA). Não decompilei nada; só li cadeias de texto.

**[verificado por strings]**
- PE de **32 bits (x86)**, 13 MB, 9 seções, com o PJSIP **linkado estaticamente** (cadeia `pjnath-2.15.1`; caminhos de compilação `c:\work\pjsip\pjlib`, `pjmedia`). Logo, o motor é o **PJSIP 2.15.1**.
- **OpenSSL 1.1.1o (3 mai 2022)** embutido (TLS e DTLS-SRTP). Essa versão está fora de suporte, o que é um ponto de atenção de segurança no MicroSIP e uma razão para o Workscape Phone usar uma versão atual.
- Código de codecs presente no binário: **AMR e AMR-WB, G.722, G.722.1, G.729, GSM**, entre outros. Presença no binário não prova que esteja habilitado em tempo de execução. **[não verificado]**
- Sinalização: `dtmf-relay` (SIP INFO), `telephone-event` (RFC 2833), `Replaces`, `P-Registrar-Error`, `rtpmap`.
- DLLs ao lado do executável: `avcodec-60`, `avformat-60`, `avutil-58`, `swscale-7` (FFmpeg), `SDL2`, `lame_enc` (MP3 para gravação).
- Importações do sistema: `WINMM` (áudio), `WS2_32` (sockets), `IPHLPAPI` (mudança de rede), `CRYPT32`, `ole32`.

**[hipótese, precisa do REA]** quais codecs e opções vêm ligados por padrão, a ordem de prioridade dos codecs, e o conteúdo exato do INVITE/SDP. Para isso falta decompilar ou observar o tráfego de uma chamada de teste.

**Bloqueio para análise com REA:** instalar o Ghidra 12.1.x (e Java 21) e definir `GHIDRA_INSTALL_DIR`. O disco da máquina está com 5 GB livres (95% usado).

### 9.1 Resultado da análise com o REA (Ghidra 12.1.4), 2026-10-27

Comando: `rea inspect MicroSIP.exe` (evidência `ev_4a303fc86f68…`, SHA-256 do alvo igual ao da seção 9). A primeira tentativa estourou o limite padrão de 330 s do Ghidra; a segunda, com 25 minutos, concluiu.

**[verificado pelo REA/Ghidra]**
- Formato PE, arquitetura **x86**, imagem base `0x400000`.
- 11 segmentos; `.text` com **10,2 MB** de código (`0x401000`–`0xdbe400`), `.rdata` 1,8 MB, `.data` 0,9 MB, `.rsrc` 0,6 MB.
- **31.402 procedimentos** e **16.983 strings** identificados.
- Confiança "derivada"; o REA ressalva que são observações do Ghidra, não execução.

**[ainda não feito]** decompilar funções específicas: a tabela de prioridade de codecs, o SDP montado no INVITE e os padrões de configuração. Cada `rea` na linha de comando reimporta o binário do zero (leva minutos). O caminho eficiente é usar o servidor MCP do REA depois de **reiniciar o Claude Code**: ele mantém o alvo aberto entre chamadas.

## 12. Build de Windows do motor (2026-10-27)

O workflow `phone-engine-windows.yml` do repositório `WorkScape-intra-net` concluiu com sucesso: PJSIP 2.15.1 (SHA-256 fixo) compilado em `Release-Static` x64, motor compilado com `/MT`, teste de fumaça (`ping` → `pong`) aprovado e executável publicado como artefato com hash. **[verificado: job verde]** **[não verificado]** execução em PC Windows real, áudio com microfone e alto-falante, e chamada a partir do `.exe`.

Lições do build, para não repetir: `Release|x64` do PJSIP usa runtime DLL (`/MD`); `Release-Static` usa `/MT`; cada módulo grava as `.lib` em `<módulo>\lib` e as de terceiros em `third_party\lib`.

SHA-256 do `workscape-phone-engine.exe` impresso pelo CI neste build (informado pelo usuário a partir do log, não conferido localmente): `6c7e74b0e6506e0fd0821835e3deaa9ecdb7869591a2a4b4efd5213cd16e8a89`.
