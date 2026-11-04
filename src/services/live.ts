import { defaultConfig } from "../../electron/policy";

export const livePreview = import.meta.env.DEV && import.meta.env.MODE === "live";
type Service = "chat" | "agenda" | "dashboard";

// Somente o servidor de desenvolvimento implementa estes proxies de destinos fixos.
// Origens personalizadas e o Electron mantêm o transporte normal.
export function serviceEndpoint(service: Service, origin: string) {
  return livePreview && !window.desktop && origin === defaultConfig[service]
    ? `${window.location.origin}/__workspace/${service}`
    : origin;
}

export function socketEndpoint(service: Service, origin: string) {
  const endpoint = serviceEndpoint(service, origin);
  return endpoint === origin
    ? { url: origin, path: "/socket.io" }
    : { url: window.location.origin, path: `/__workspace/${service}/socket.io` };
}
