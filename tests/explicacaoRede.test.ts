import { describe, expect, it } from "vitest";
import { porteDoIncidente, resumoCurto, textoParaAtendimento } from "../src/modules/rede/explicacao";
import type { IncidenteRede } from "../src/services/redeOlt";

const base: IncidenteRede = { id: "1", tipo: "pon_loss", oltId: "9", olt: "OLT Caieiras", inicio: "2026-10-24T17:00:00Z", descricao: "", totalDispositivos: 40, dispositivosAtivos: 24, pon: "3", slotPon: "1/3", cto: "" };
const agora = Date.parse("2026-10-24T17:30:00Z");

describe("explicação da queda de rede", () => {
  it("define o porte pela quantidade e pela proporção", () => {
    expect(porteDoIncidente({ dispositivosAtivos: 40, totalDispositivos: 200 })).toBe("massiva");
    expect(porteDoIncidente({ dispositivosAtivos: 6, totalDispositivos: 8 })).toBe("massiva");
    expect(porteDoIncidente({ dispositivosAtivos: 10, totalDispositivos: 100 })).toBe("parcial");
    expect(porteDoIncidente({ dispositivosAtivos: 2, totalDispositivos: 100 })).toBe("pontual");
    expect(porteDoIncidente({ dispositivosAtivos: null, totalDispositivos: null })).toBe("parcial");
  });
  it("aviso curto traz quantidade e porcentagem", () => {
    expect(resumoCurto(base)).toBe("Queda massiva · 24 clientes de 40 (60%) sem conexão");
    expect(resumoCurto({ ...base, dispositivosAtivos: 8 })).toBe("8 clientes de 40 (20%) sem conexão");
    expect(resumoCurto({ ...base, tipo: "no_power", dispositivosAtivos: 50, totalDispositivos: 60 })).toMatch(/^Queda massiva · 50 clientes de 60 \(83%\) sem energia/);
  });
  it("texto do atendimento é simples e não usa termos técnicos", () => {
    const t = textoParaAtendimento(base, { agora });
    expect(t).toMatch(/Queda massiva de internet na região atendida por OLT Caieiras/);
    expect(t).toMatch(/24 clientes afetados de 40/);
    expect(t).toMatch(/há 30 minutos/);
    expect(t).not.toMatch(/PON|LOSS|slot/i);
  });
  it("falta de energia explica que volta sozinho e aponta evento regional", () => {
    const t = textoParaAtendimento({ ...base, tipo: "no_power" }, { agora, panorama: { configurada: true, porOlt: [{ olt: "OLT Caieiras", semEnergia: 300, loss: 0 }] } });
    expect(t).toMatch(/sem energia elétrica/);
    expect(t).toMatch(/problema regional/);
    expect(t).toMatch(/volta sozinho/);
  });
});
