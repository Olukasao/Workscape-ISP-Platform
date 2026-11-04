import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { CornerDownLeft, Search } from "lucide-react";
import { clsx } from "clsx";
import { usePermittedTools } from "../../modules/toolCatalog";
import { toolGroups } from "../../modules/toolCatalog";
import { Kbd } from "../../components/ui/primitives";
import type { NavEntry } from "./Sidebar";

type Item = {
  path: string;
  title: string;
  hint: string;
  group: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
};

const normalize = (s: string) =>
  s
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export function CommandPalette({
  open,
  onClose,
  entries,
}: {
  open: boolean;
  onClose: () => void;
  entries: NavEntry[];
}) {
  const navigate = useNavigate();
  const { tools } = usePermittedTools();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const items = useMemo<Item[]>(() => {
    const groupName = Object.fromEntries(toolGroups);
    const all: Item[] = [
      ...entries.map((e) => ({
        path: e.path,
        title: e.label,
        hint: "Módulo",
        group: "Módulos",
        icon: e.icon,
      })),
      ...(tools as unknown as (Omit<Item, "hint"> & { description: string })[]).map((t) => ({
        path: t.path,
        title: t.title,
        hint: t.description,
        group: groupName[t.group] || "Ferramentas",
        icon: t.icon,
      })),
    ];
    const q = normalize(query.trim());
    return q
      ? all.filter((i) => normalize(`${i.title} ${i.hint} ${i.group}`).includes(q))
      : all;
  }, [entries, tools, query]);
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setIndex(0);
    const previous = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => input.current?.focus());
    return () => previous?.focus?.();
  }, [open]);
  useEffect(() => setIndex(0), [query]);
  useEffect(() => {
    list.current
      ?.querySelector<HTMLElement>(`[data-index="${index}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [index]);
  if (!open) return null;
  const go = (item?: Item) => {
    if (!item) return;
    onClose();
    navigate(item.path);
  };
  let lastGroup = "";
  return createPortal(
    <div className="palette-backdrop" onMouseDown={onClose}>
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Buscar no workspace"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            setIndex((i) => Math.min(items.length - 1, i + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setIndex((i) => Math.max(0, i - 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            go(items[index]);
          } else if (e.key === "Tab") e.preventDefault();
        }}
      >
        <label className="palette-input">
          <Search size={18} />
          <input
            ref={input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ir para módulo ou ferramenta…"
            aria-label="Buscar no workspace"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-results"
            aria-activedescendant={items[index] ? `palette-${index}` : undefined}
          />
          <Kbd>Esc</Kbd>
        </label>
        {items.length ? (
          <ul className="palette-list" id="palette-results" role="listbox" ref={list}>
            {items.map((item, i) => {
              const header = item.group !== lastGroup ? item.group : null;
              lastGroup = item.group;
              return (
                <li key={item.path} role="presentation">
                  {header ? (
                    <span className="palette-group" role="presentation">
                      {header}
                    </span>
                  ) : null}
                  <button
                    id={`palette-${i}`}
                    data-index={i}
                    role="option"
                    tabIndex={-1}
                    aria-selected={i === index}
                    className={clsx(i === index && "is-active")}
                    onMouseMove={() => setIndex(i)}
                    onClick={() => go(item)}
                  >
                    <span className="palette-icon">
                      <item.icon size={16} strokeWidth={1.8} />
                    </span>
                    <span className="palette-copy">
                      <strong>{item.title}</strong>
                      <small>{item.hint}</small>
                    </span>
                    {i === index ? <CornerDownLeft size={14} /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="palette-empty">Nada encontrado para “{query}”.</p>
        )}
        <div className="palette-foot">
          <span>
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navegar
          </span>
          <span>
            <Kbd>Enter</Kbd> abrir
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
