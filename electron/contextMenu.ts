import { Menu, session, type WebContents } from "electron";

/** Idiomas do corretor ortográfico: português e inglês, quando o Windows tiver o dicionário. */
export function configureSpellChecker() {
  const s = session.defaultSession;
  const wanted = ["pt-BR", "en-US"].filter((l) => s.availableSpellCheckerLanguages.includes(l));
  if (wanted.length) s.setSpellCheckerLanguages(wanted);
  s.setSpellCheckerEnabled(true);
}

/**
 * Menu de clique direito: sugestões do corretor (palavras sublinhadas), adicionar ao dicionário e as
 * ações de edição. O Electron não mostra nenhum menu por conta própria.
 */
export function attachContextMenu(wc: WebContents) {
  wc.on("context-menu", (_event, params) => {
    const editable = params.isEditable;
    const hasSelection = params.selectionText.trim().length > 0;
    if (!editable && !hasSelection) return;
    const items: Electron.MenuItemConstructorOptions[] = [];
    if (editable && params.misspelledWord) {
      const suggestions = params.dictionarySuggestions.slice(0, 5);
      if (suggestions.length) {
        for (const suggestion of suggestions)
          items.push({ label: suggestion, click: () => wc.replaceMisspelling(suggestion) });
      } else {
        items.push({ label: "Sem sugestões", enabled: false });
      }
      items.push(
        { type: "separator" },
        { label: "Adicionar ao dicionário", click: () => wc.session.addWordToSpellCheckerDictionary(params.misspelledWord) },
        { type: "separator" },
      );
    }
    if (editable) {
      items.push(
        { label: "Desfazer", role: "undo", enabled: params.editFlags.canUndo },
        { label: "Refazer", role: "redo", enabled: params.editFlags.canRedo },
        { type: "separator" },
        { label: "Recortar", role: "cut", enabled: params.editFlags.canCut },
        { label: "Copiar", role: "copy", enabled: params.editFlags.canCopy },
        { label: "Colar", role: "paste", enabled: params.editFlags.canPaste },
        { label: "Selecionar tudo", role: "selectAll" },
      );
    } else {
      items.push({ label: "Copiar", role: "copy" });
    }
    Menu.buildFromTemplate(items).popup();
  });
}
