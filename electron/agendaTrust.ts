import { X509Certificate } from "node:crypto";
import { agendaCertificateSha256, agendaOrigin } from "./agendaDeployment";

export function isPinnedAgendaCertificate(
  configuredOrigin: string,
  hostname: string,
  pem: string,
  now = Date.now(),
) {
  if (
    configuredOrigin !== agendaOrigin ||
    hostname !== new URL(agendaOrigin).hostname
  )
    return false;
  try {
    const cert = new X509Certificate(pem);
    return (
      cert.fingerprint256.replaceAll(":", "") === agendaCertificateSha256 &&
      now >= Date.parse(cert.validFrom) &&
      now <= Date.parse(cert.validTo)
    );
  } catch {
    return false;
  }
}
