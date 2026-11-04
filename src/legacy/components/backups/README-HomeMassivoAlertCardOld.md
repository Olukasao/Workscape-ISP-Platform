# Backup visual antigo - Alertas/Massivos da home oficial

Este backup preserva o JSX e o CSS do card anterior à implementação dos
estados de cartão amarelo e cartão vermelho.

- `HomeMassivoAlertCardOld.jsx`: JSX antigo com dados dinâmicos.
- `HomeMassivoAlertCardOld.css`: estilos específicos do card antigo.

Para restaurar, importe o componente em `ChatPage.jsx` e passe:

```jsx
<HomeMassivoAlertCardOld
  conectado={dashboardAlertasConectado}
  massivos={massivosDashboard}
  onOpen={() => window.open('http://192.168.1.133/', '_blank', 'noopener,noreferrer')}
/>
```
