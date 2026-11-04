# Product

<!-- impeccable:product-schema 1 -->

Acessa Workspace: aplicativo desktop interno (Electron) da AcessaNet, provedor de internet por fibra óptica. Reúne num só lugar o chat interno, a agenda de técnicos, o painel NOC, chamados, ferramentas da intranet, um navegador com os sistemas da empresa (SGP, OLT, Zabbix, Grafana) e a Inteligência Artificial interna.

## Platform

web (renderizado dentro do Electron, Windows; também roda em navegador para prévia)

## Users

Todos os setores da AcessaNet usam a mesma tela inicial: NOC, suporte técnico (N1, N2, N3), atendimento, comercial, financeiro e gestão. Funcionários, não técnicos de software: os textos precisam ser simples, sem jargão.

## Product Purpose

Abrir o dia de trabalho e chegar rápido ao que se usa todo dia. O Início mostra a situação do dia (resumo automático da IA, mensagens, avisos, massivos, filas) e leva às ferramentas mais usadas.

## Operating Context

Aberto várias vezes por dia em monitores de escritório, muitas vezes ao lado de outras janelas. A pessoa olha por segundos e segue para o chat, a agenda ou o Navegador.

## Capabilities and Constraints

- Tema escuro e claro (`data-theme="claro"`), zoom da interface (a captura padrão roda a 0,7).
- Dados reais: chat (não lidas), avisos internos, painel NOC (massivos por região, filas Suporte Técnico/N1/N2/N3), resumo da agenda de técnicos, banner e novidades vindos do servidor.
- O resumo de hoje da IA só existe quando a IA está ligada em Admin > IA; sem ela a tela precisa ficar completa.
- Sem dados sensíveis de clientes no resumo (CPF, telefone, endereço).

## Brand Commitments

Marca AcessaNet: azul elétrico (#2f6bff) e ciano (#3ad6ff) sobre azul-marinho; fontes Sora (títulos) e Manrope (texto); a fibra óptica como imagem da empresa.

## Product Principles

- Mostrar a situação, não pedir cliques: o resumo de hoje aparece sozinho.
- Um clique até as ferramentas do dia: Chat interno, Agenda técnica, Navegador, Inteligência Artificial, Ferramentas.
- Nada genérico: o Início deve parecer da AcessaNet, não um template.

## Accessibility & Inclusion

Contraste AA nos dois temas, foco de teclado visível, respeitar "reduzir movimento".
