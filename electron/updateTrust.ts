import { X509Certificate } from "node:crypto";
import { updateCertificateSha256, updateOrigin } from "./updateDeployment";

export function isPinnedUpdateCertificate(hostname: string, pem: string, now = Date.now()) {
  if (hostname !== new URL(updateOrigin).hostname) return false;
  try {
    const cert = new X509Certificate(pem);
    return updateCertificateSha256.includes(cert.fingerprint256.replaceAll(":", "")) &&
      now >= Date.parse(cert.validFrom) && now <= Date.parse(cert.validTo);
  } catch {
    return false;
  }
}
