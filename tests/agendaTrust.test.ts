import { readFileSync } from "node:fs";
import { rootCertificates } from "node:tls";
import { describe, expect, it } from "vitest";
import { isPinnedAgendaCertificate } from "../electron/agendaTrust";
import { agendaOrigin } from "../electron/agendaDeployment";
import {
  defaultConfig,
  serviceNames,
  validateConfig,
  resolveRequest,
} from "../electron/policy";

const pem = readFileSync("tests/fixtures/agenda-public.crt", "utf8");
const now = Date.parse("2026-10-19T12:00:00Z");
describe("conexão da agenda corporativa", () => {
  it("reconhece somente o certificado exato do servidor conhecido, dentro da validade", () => {
    expect(
      isPinnedAgendaCertificate(agendaOrigin, "192.168.1.133", pem, now),
    ).toBe(true);
    expect(
      isPinnedAgendaCertificate(agendaOrigin, "evil.example", pem, now),
    ).toBe(false);
    expect(
      isPinnedAgendaCertificate(
        "https://outro.example",
        "192.168.1.133",
        pem,
        now,
      ),
    ).toBe(false);
    expect(
      isPinnedAgendaCertificate(agendaOrigin, "192.168.1.133", "inválido", now),
    ).toBe(false);
    expect(
      isPinnedAgendaCertificate(
        agendaOrigin,
        "192.168.1.133",
        rootCertificates[0],
        now,
      ),
    ).toBe(false);
    expect(
      isPinnedAgendaCertificate(
        agendaOrigin,
        "192.168.1.133",
        pem,
        Date.parse("2027-04-09"),
      ),
    ).toBe(false);
    expect(
      isPinnedAgendaCertificate(
        agendaOrigin,
        "192.168.1.133",
        pem,
        Date.parse("2026-04-01"),
      ),
    ).toBe(false);
  });
  it("preenche a origem real ao atualizar configurações antigas ou vazias", () => {
    for (const agenda of [
      "",
      "http://192.168.1.133:8500",
      "http://192.168.1.133:8500/",
      "https://agenda.suaempresa.com.br",
    ]) {
      const config = validateConfig({
        ...defaultConfig,
        agenda,
        instalacao: "https://instalacao.example.org",
      });
      expect(config.agenda).toBe(agendaOrigin);
      expect(config).not.toHaveProperty("instalacao");
    }
    expect(
      validateConfig({
        ...defaultConfig,
        agenda: "https://gateway.example.org",
      }).agenda,
    ).toBe("https://gateway.example.org");
  });
  it("recusa o serviço removido pela API IPC", () => {
    expect(serviceNames).not.toContain("instalacao");
    expect(() =>
      resolveRequest(defaultConfig, {
        service: "instalacao",
        path: "/api/technician-absences",
        method: "GET",
      }),
    ).toThrow();
  });
});
