// Feriados nacionais fixos (MM-DD) — Lei 11.419/2006 exclui fins de semana e feriados nacionais
const FERIADOS_FIXOS = new Set([
  "01-01", // Confraternização Universal
  "04-21", // Tiradentes
  "05-01", // Dia do Trabalho
  "09-07", // Independência do Brasil
  "10-12", // Nossa Senhora Aparecida
  "11-02", // Finados
  "11-15", // Proclamação da República
  "12-25", // Natal
]);

function isDiaUtil(d: Date): boolean {
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false;
  const key = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return !FERIADOS_FIXOS.has(key);
}

function addDiasUteis(base: Date, n: number): Date {
  const d = new Date(base);
  let added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    if (isDiaUtil(d)) added++;
  }
  return d;
}

export function parseDataBR(s: string): Date | null {
  const parts = s.split("/");
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts.map(Number);
  if (!dd || !mm || !yyyy) return null;
  const d = new Date(yyyy, mm - 1, dd);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDataBR(d: Date): string {
  return [
    String(d.getDate()).padStart(2, "0"),
    String(d.getMonth() + 1).padStart(2, "0"),
    d.getFullYear(),
  ].join("/");
}

export interface PrazosLei {
  disponibilizacao: string;
  publicacao: string;
  inicio_prazo: string;
  prazo_final: string | null;
}

export function calcularPrazos(
  disponibilizacaoStr: string,
  prazoDias: number | null
): PrazosLei | null {
  const disp = parseDataBR(disponibilizacaoStr);
  if (!disp) return null;
  const publicacao = addDiasUteis(disp, 1);
  const inicio = addDiasUteis(publicacao, 1);
  const final = prazoDias != null ? addDiasUteis(inicio, prazoDias) : null;
  return {
    disponibilizacao: formatDataBR(disp),
    publicacao: formatDataBR(publicacao),
    inicio_prazo: formatDataBR(inicio),
    prazo_final: final ? formatDataBR(final) : null,
  };
}
