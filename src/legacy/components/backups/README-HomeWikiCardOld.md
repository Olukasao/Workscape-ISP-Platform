# Backup visual antigo - Wiki Interna da home oficial

Este backup preserva o card que existia na home antes da adoção do
`WikiCopaCard`.

- `HomeWikiCardOld.jsx`: JSX completo do card antigo.
- `HomeWikiCardOld.css`: estilos e responsividade do card antigo.

Para restaurar, importe `HomeWikiCardOld` em `ChatPage.jsx` e use:

```jsx
<HomeWikiCardOld onOpen={() => navigate('/wiki')} />
```
