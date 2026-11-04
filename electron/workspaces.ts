import { app, screen } from "electron";
import { randomUUID } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { detachedKinds } from "./detachedWindows";

// Workspaces personalizados: conjuntos de janelas destacadas (quais painéis, onde ficam, se ficam por cima e
// se são compactos) salvos por usuário e reabertos com um clique. Só guarda posições e escolhas, nenhum dado.
export const workspaceItemSchema = z.object({
  kind: z.enum(detachedKinds),
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().min(240).max(10000),
  height: z.number().finite().min(140).max(10000),
  pinned: z.boolean(),
  compact: z.boolean(),
}).strict();
export const workspaceSchema = z.object({
  id: z.string().min(1).max(64),
  owner: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(60),
  items: z.array(workspaceItemSchema).min(1).max(detachedKinds.length),
  createdAt: z.number().finite(),
}).strict();
export type Workspace = z.infer<typeof workspaceSchema>;
export type WorkspaceItem = z.infer<typeof workspaceItemSchema>;

const file = () => path.join(app.getPath("userData"), "workspaces.json");

async function readAll(): Promise<Workspace[]> {
  try {
    const raw = JSON.parse(await readFile(file(), "utf8"));
    return z.array(workspaceSchema).catch([]).parse(raw);
  } catch {
    return [];
  }
}
async function writeAll(list: Workspace[]) {
  await writeFile(file() + ".tmp", JSON.stringify(list), { mode: 0o600 });
  await rename(file() + ".tmp", file());
}

export const listWorkspaces = async (owner: string) => (await readAll()).filter((w) => w.owner === owner);

export async function saveWorkspace(owner: string, name: string, items: WorkspaceItem[]) {
  const all = await readAll();
  const mine = all.filter((w) => w.owner === owner);
  if (mine.length >= 30) throw new Error("Limite de 30 workspaces atingido. Exclua algum para criar outro.");
  const clean = name.trim();
  // Mesmo nome = atualiza o existente (substitui a disposição).
  const existing = mine.find((w) => w.name.toLowerCase() === clean.toLowerCase());
  const workspace: Workspace = { id: existing?.id ?? randomUUID(), owner, name: clean, items, createdAt: Date.now() };
  await writeAll([...all.filter((w) => w.id !== workspace.id), workspace]);
  return workspace;
}

export async function deleteWorkspace(owner: string, id: string) {
  await writeAll((await readAll()).filter((w) => !(w.owner === owner && w.id === id)));
}

export async function findWorkspace(owner: string, id: string) {
  return (await readAll()).find((w) => w.owner === owner && w.id === id) ?? null;
}

/**
 * Distribui os painéis escolhidos na tela principal, sem sobrepor: 1 = tela toda; 2 = lado a lado;
 * 3 = um grande à esquerda e dois empilhados; 4+ = grade.
 */
export function tileLayout(kinds: (typeof detachedKinds)[number][], opts: { pinned: boolean; compact: boolean }): WorkspaceItem[] {
  const a = screen.getPrimaryDisplay().workArea;
  const n = kinds.length;
  const cell = (col: number, row: number, cols: number, rows: number, spanRows = 1) => ({
    x: Math.round(a.x + (a.width / cols) * col),
    y: Math.round(a.y + (a.height / rows) * row),
    width: Math.round(a.width / cols),
    height: Math.round((a.height / rows) * spanRows),
  });
  return kinds.map((kind, i) => {
    let box;
    if (n === 1) box = cell(0, 0, 1, 1);
    else if (n === 2) box = cell(i, 0, 2, 1);
    else if (n === 3) box = i === 0 ? cell(0, 0, 2, 1, 1) : cell(1, i - 1, 2, 2);
    else {
      const cols = n <= 4 ? 2 : 3;
      const rows = Math.ceil(n / cols);
      box = cell(i % cols, Math.floor(i / cols), cols, rows);
    }
    return { kind, ...box, pinned: opts.pinned, compact: opts.compact };
  });
}
