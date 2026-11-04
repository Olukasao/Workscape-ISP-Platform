// Canal interno de atualização. Sem assinatura Authenticode, a identidade do
// servidor é garantida pelo certificado fixado abaixo (somente a parte pública).
export const updateOrigin = "https://192.168.1.133:8643";
// SHA-256 dos certificados aceitos para o canal (config/tls/server.crt). Para
// trocar o certificado, publique antes uma versão que aceite os dois.
export const updateCertificateSha256 = [
  "9DAD7E96A6964864B3925D37F9CA12C7C007CA94A26A64C182B1B422C0BFACE5",
];
