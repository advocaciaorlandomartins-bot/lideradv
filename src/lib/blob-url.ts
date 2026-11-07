/**
 * Validação centralizada de URLs do Vercel Blob. Nunca confiar em
 * `.includes(".blob.vercel-storage.com")` — essa string pode aparecer em
 * qualquer parte de uma URL maliciosa (ex.: "https://evil.com/?x=.blob.vercel-storage.com"),
 * permitindo SSRF: o servidor buscaria o conteúdo de um host arbitrário
 * controlado pelo atacante. Sempre validar pelo HOSTNAME de verdade via
 * `new URL(url).hostname`, nunca por substring da URL crua.
 *
 * Achado em auditoria de segurança (2026-11-07): 12 pontos no código usavam
 * a checagem por substring. Corrigido centralizando aqui.
 */
function parseHttpsUrl(url: string): URL | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    return parsed;
  } catch {
    return null;
  }
}

/** true se a URL é um blob nosso (público ou privado) do Vercel Blob. */
export function isUrlPermitida(url: string): boolean {
  const parsed = parseHttpsUrl(url);
  if (!parsed) return false;
  const host = parsed.hostname;
  return (
    host === "blob.vercel-storage.com" ||
    host.endsWith(".blob.vercel-storage.com")
  );
}

/**
 * true se a URL é especificamente um blob PRIVADO nosso — usado para decidir
 * se o Authorization Bearer (BLOB_READ_WRITE_TOKEN) deve ser enviado. Nunca
 * relaxar isso pra substring: enviaria o token de leitura/escrita do Blob
 * pra qualquer host que o atacante controlar.
 */
export function isBlobPrivado(url: string): boolean {
  const parsed = parseHttpsUrl(url);
  if (!parsed) return false;
  return parsed.hostname.endsWith(".private.blob.vercel-storage.com");
}
