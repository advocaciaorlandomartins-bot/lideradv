/** Converte "DD/MM/YYYY" para "YYYY-MM-DD" (formato aceito por colunas date). */
export function brParaIso(br: string | null | undefined): string | null {
  if (!br) return null;
  const [d, m, y] = br.split("/");
  return d && m && y ? `${y}-${m}-${d}` : null;
}
