import type { ReactNode } from "react";

/**
 * Wrapper padrão pra cards de métrica da Controladoria — reaproveitado nas
 * abas Processos/Econômica/Clientes. Inspirado no padrão do Tramita: todo
 * painel diz de onde vem a base de cálculo (quantos processos/clientes
 * entraram na conta), em vez de só soltar um número sem contexto.
 */
export function Painel({
  titulo,
  icon,
  subtitulo,
  baseDeCalculo,
  children,
}: {
  titulo: string;
  icon?: ReactNode;
  subtitulo?: string;
  baseDeCalculo?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-white shadow-sm">
      <div className="flex items-start gap-3 border-b border-border px-5 py-4">
        {icon && (
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h2 className="font-heading text-sm font-bold text-fg">{titulo}</h2>
          {subtitulo && (
            <p className="font-body text-xs text-muted">{subtitulo}</p>
          )}
        </div>
      </div>
      <div className="p-5">{children}</div>
      {baseDeCalculo && (
        <div className="border-t border-border px-5 py-2.5">
          <p className="font-body text-[11px] text-muted">{baseDeCalculo}</p>
        </div>
      )}
    </div>
  );
}

export function EstadoVazio({ texto }: { texto: string }) {
  return (
    <p className="py-6 text-center font-body text-sm text-muted">{texto}</p>
  );
}
