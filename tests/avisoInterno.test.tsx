// @vitest-environment node
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import InternalNoticeModal from "../src/legacy/components/InternalNoticeModal";

const base = {
  title: "Manutenção na rede", type: "Comunicado", category: "Rede", priority: "critica", isNew: true,
  createdByName: "Carlos Souza", requireConfirmation: true, allowClose: false, allowSnooze: false,
  sections: {
    resume: "Troca de **equipamentos** no domingo.",
    changes: [{ icon: "wifi", title: "Backbone", description: "Troca do switch." }],
    importantInfo: ["Avise os clientes."],
    actionRequired: { title: "Confirme a leitura", description: "Fica registrado." },
  },
};
const html = (notice: object, extra: object = {}) =>
  renderToStaticMarkup(<InternalNoticeModal notice={notice} onClose={() => {}} onConfirm={() => {}} onSnooze={() => {}} onOpenDetails={() => {}} {...extra} />);

describe("caixa do aviso interno", () => {
  it("mostra título, prioridade, resumo em negrito, ação e quem publicou", () => {
    const h = html(base);
    expect(h).toContain("Manutenção na rede");
    expect(h).toContain("Prioridade Crítica");
    expect(h).toContain("<strong>equipamentos</strong>");
    expect(h).toContain("Confirme a leitura");
    expect(h).toContain("Publicado por");
    expect(h).toContain("Carlos Souza");
    expect(h).toContain("NOVO");
  });

  it("aviso obrigatório (com confirmação e sem botão de fechar) avisa e não tem o X", () => {
    const h = html(base);
    expect(h).toContain("OBRIGATÓRIO");
    expect(h).toContain("Confirme a leitura para continuar usando o Workspace.");
    expect(h).toContain("Confirmar leitura");
    expect(h).not.toContain("Fechar aviso interno");
  });

  it("aviso que pode ser fechado tem o X e não se diz obrigatório", () => {
    const h = html({ ...base, allowClose: true });
    expect(h).toContain("Fechar aviso interno");
    expect(h).not.toContain("OBRIGATÓRIO");
  });

  it("'Lembrar depois' e 'Ver detalhes' só aparecem quando liberados", () => {
    expect(html(base)).not.toContain("Lembrar depois");
    const h = html({ ...base, allowSnooze: true, detailUrl: "/avisos", detailButtonText: "Abrir regras" });
    expect(h).toContain("Lembrar depois");
    expect(h).toContain("Abrir regras");
  });

  it("sem confirmação o botão vira 'Fechar aviso' e prioridade inválida cai em média", () => {
    const h = html({ ...base, requireConfirmation: false, priority: "urgentissima" });
    expect(h).toContain("Fechar aviso");
    expect(h).toContain("Prioridade Média");
  });

  it("um aviso simples, sem seções, não quebra", () => {
    const h = html({ title: "Lembrete", priority: "baixa", sections: {} });
    expect(h).toContain("Lembrete");
    expect(h).toContain("Prioridade Baixa");
  });
});
