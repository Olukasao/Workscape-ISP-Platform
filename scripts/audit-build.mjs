import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
const forbidden = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:DB_PASSWORD|MYSQL_PASSWORD|MARIADB_PASSWORD|SGP_PASSWORD)\s*[:=]\s*['"][^'"]+['"]/i,
  /(?:AKIA|ASIA)[A-Z0-9]{16}/,
  /gh[pousr]_[A-Za-z0-9]{30,}/,
  /sk-(?:proj-)?[A-Za-z0-9_-]{30,}/,
];
async function scan(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const name = path.join(dir, entry.name);
    if (entry.isDirectory()) await scan(name);
    else {
      if (/\.(pem|key|env|sql)$/.test(name))
        throw new Error(`Arquivo confidencial incorporado: ${name}`);
      if (/\.(js|cjs|json|html|css)$/.test(name)) {
        const data = await readFile(name, "utf8");
        if (forbidden.some((p) => p.test(data)))
          throw new Error(`Padrão de segredo detectado em ${name}`);
      }
    }
  }
}
await scan("dist");
await scan("dist-electron");
console.log(
  "Build verificado: nenhum arquivo de backend, .env, chave privada ou padrão de segredo identificado. Esta análise por padrões não prova ausência de todos os segredos.",
);
