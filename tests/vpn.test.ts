import { describe, expect, it } from "vitest";
import { conflitoDeRede, redeDe } from "../electron/vpn";

describe("redeDe", () => {
  it("devolve a faixa /24 de endereços privados", () => {
    expect(redeDe("192.168.1.133")).toBe("192.168.1.0/24");
    expect(redeDe("10.5.7.9")).toBe("10.5.7.0/24");
    expect(redeDe("172.20.1.1")).toBe("172.20.1.0/24");
  });
  it("recusa públicos, nomes e inválidos", () => {
    expect(redeDe("8.8.8.8")).toBeNull();
    expect(redeDe("chat.empresa.com.br")).toBeNull();
    expect(redeDe("192.168.1.999")).toBeNull();
    expect(redeDe("172.32.0.1")).toBeNull();
  });
});

describe("conflitoDeRede", () => {
  const eth = (address: string) => [{ family: "IPv4", internal: false, address }] as never;
  it("acusa a rede de casa com a mesma faixa do escritório", () => {
    expect(conflitoDeRede("192.168.1.0/24", { "Wi-Fi": eth("192.168.1.20") })).toBe("Wi-Fi");
  });
  it("ignora o adaptador da própria VPN e redes diferentes", () => {
    expect(conflitoDeRede("192.168.1.0/24", { "Minha VPN (ppp)": eth("192.168.1.250") })).toBeNull();
    expect(conflitoDeRede("192.168.1.0/24", { "Wi-Fi": eth("192.168.50.7") })).toBeNull();
  });
});
