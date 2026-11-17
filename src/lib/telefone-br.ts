// Normalização de telefone celular brasileiro, compartilhada entre as rotas
// de integração com o PrevBot. Extraído de usuario/route.ts (2026-11-17) pra
// não triplicar a mesma lógica numa 3ª rota (cliente-por-telefone).

export function normalizarTelefoneBR(tel: string): string {
  const digits = tel.replace(/\D/g, "");
  // DDI 55 + DDD + número: 13 dígitos se o número tem o 9 (11 dígitos de
  // DDD+número), 12 se não tem (10 dígitos de DDD+número — ex: telefone de
  // cliente cadastrado sem o 9, caso real do Wilson). Antes só cobria o caso
  // de 13, então um número de 12 dígitos chegava com o "55" ainda colado,
  // nunca batendo com o cadastro (que não tem DDI).
  if ((digits.length === 13 || digits.length === 12) && digits.startsWith("55"))
    return digits.slice(2);
  return digits;
}

// Celular BR pode ter 10 dígitos (DDD + 8) ou 11 (DDD + 9 + 8) — o nono
// dígito fica logo DEPOIS do DDD, não no final. Comparar só os últimos 9
// dígitos não resolve a ambiguidade: "82998441109" (11) e "8298441109" (10,
// mesmo número) geram sufixos de 9 dígitos diferentes ("998441109" vs
// "298441109"). Remove o 9 extra (se houver) logo após o DDD antes de
// comparar — mesma correção já aplicada do lado do PrevBot
// (mesmoTelefoneBR/chaveTelefoneBR em lideradv.ts).
export function chaveTelefoneBR(telNormalizado: string): string {
  const d = telNormalizado.replace(/\D/g, "");
  if (d.length === 11) return d.slice(0, 2) + d.slice(3);
  return d;
}
