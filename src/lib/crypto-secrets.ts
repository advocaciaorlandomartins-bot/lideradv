import crypto from "crypto";

// Criptografia simétrica pra segredos de terceiros guardados no banco (ex:
// token de API do Asaas) — sem isso, qualquer um com acesso ao Postgres
// (backup, dump, outra falha SQL) lia a chave em texto puro. A chave usada
// aqui é derivada do SESSION_SECRET com um salt próprio (não reaproveita o
// mesmo material usado pra assinar a sessão via HMAC).

function getKey(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET não definida.");
  return crypto.scryptSync(secret, "lideradv-crypto-secrets-v1", 32);
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptSecret(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Formato de segredo criptografado inválido.");
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}

/** true se o valor já está no formato criptografado deste módulo. */
export function isEncryptedSecret(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("v1:");
}
