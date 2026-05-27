"use client";

import { useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { SpinnerIcon } from "@/components/icons";
import {
  createControleAction,
  updateControleAction,
  type ControleFormState,
} from "@/lib/controles-actions";
import {
  TIPOS_CONTROLE,
  TIPOS_DEMANDA,
  STATUS_CONTROLE,
  getTipoConfig,
  type Controle,
  type ClienteOption,
  type ProcessoOption,
  type UsuarioOption,
} from "@/lib/controles-types";

const inputCls =
  "w-full h-10 rounded-lg border border-border bg-white px-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100";
const labelCls = "block font-body text-sm font-semibold text-fg mb-1.5";
const selectCls =
  "w-full h-10 cursor-pointer rounded-lg border border-border bg-white px-3 font-body text-sm text-fg outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100";

interface Props {
  controle?: Controle;
  tipoInicial: string;
  clientes: ClienteOption[];
  processos: ProcessoOption[];
  usuarios: UsuarioOption[];
}

function normalizeSearch(s: string) {
  return s.toLowerCase().replace(/\D/g, "") || s.toLowerCase();
}

export default function ControleForm({
  controle,
  tipoInicial,
  clientes,
  processos,
  usuarios,
}: Props) {
  const isEdit = !!controle;
  const router = useRouter();

  const action = isEdit ? updateControleAction : createControleAction;
  const [state, formAction, pending] = useActionState<
    ControleFormState,
    FormData
  >(action, null);

  const [tipo, setTipo] = useState(controle?.tipo ?? tipoInicial);
  const [clienteId, setClienteId] = useState(controle?.cliente_id ?? "");
  const [search, setSearch] = useState("");

  const tipoConfig = getTipoConfig(tipo);

  const filteredClientes =
    search.trim() === ""
      ? clientes
      : clientes.filter((c) => {
          const q = search.trim().toLowerCase();
          const matchNome = c.nome.toLowerCase().includes(q);
          const matchDoc =
            c.doc.replace(/\D/g, "").includes(q.replace(/\D/g, "")) &&
            q.replace(/\D/g, "").length > 0;
          return matchNome || matchDoc;
        });

  const processosDoCliente = clienteId
    ? processos.filter((p) => p.cliente_id === clienteId)
    : processos;

  if (state?.success && !isEdit) {
    router.push(`/dashboard/controles?tipo=${tipo}`);
  }

  return (
    <form action={formAction} className="flex flex-col gap-6 max-w-2xl">
      {isEdit && <input type="hidden" name="id" value={controle.id} />}
      <input type="hidden" name="tipo" value={tipo} />

      {state?.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-body text-sm text-red-700">
          {state.error}
        </div>
      )}
      {state?.success && isEdit && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 font-body text-sm text-emerald-700">
          Controle atualizado com sucesso.
        </div>
      )}

      {/* ── Vínculos ── */}
      <div className="rounded-xl border border-border bg-white p-5 space-y-4">
        <h2 className="font-heading text-sm font-semibold text-fg">Vínculos</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Busca de cliente */}
          <div className="sm:col-span-2">
            <label className={labelCls}>Buscar cliente</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nome ou CPF / CNPJ..."
              className={inputCls}
            />
            {search.trim() !== "" && (
              <p className="mt-1 font-body text-xs text-muted">
                {filteredClientes.length} cliente(s) encontrado(s)
              </p>
            )}
          </div>

          {/* Cliente */}
          <div>
            <label className={labelCls}>Cliente</label>
            <select
              name="cliente_id"
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className={selectCls}
            >
              <option value="">— Nenhum —</option>
              {filteredClientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                  {c.doc ? ` — ${c.doc}` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Processo */}
          <div>
            <label className={labelCls}>Processo</label>
            <select
              name="processo_id"
              defaultValue={controle?.processo_id ?? ""}
              className={selectCls}
            >
              <option value="">— Nenhum —</option>
              {processosDoCliente.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.numero}
                </option>
              ))}
            </select>
            {clienteId && processosDoCliente.length === 0 && (
              <p className="mt-1 font-body text-xs text-muted">
                Nenhum processo ativo para este cliente.
              </p>
            )}
          </div>

          {/* Responsável */}
          <div>
            <label className={labelCls}>Responsável</label>
            <select
              name="responsavel_id"
              defaultValue={controle?.responsavel_id ?? ""}
              className={selectCls}
            >
              <option value="">— Nenhum —</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome} ({u.login})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Identificação ── */}
      <div className="rounded-xl border border-border bg-white p-5 space-y-4">
        <h2 className="font-heading text-sm font-semibold text-fg">
          Identificação
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Tipo */}
          <div>
            <label className={labelCls}>
              Tipo de controle <span className="text-red-500">*</span>
            </label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className={selectCls}
            >
              {TIPOS_CONTROLE.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Data */}
          <div>
            <label className={labelCls}>{tipoConfig.col_data}</label>
            <input
              type="date"
              name="data_evento"
              defaultValue={controle?.data_evento ?? ""}
              className={inputCls}
            />
          </div>

          {/* Descrição */}
          <div className="sm:col-span-2">
            <label className={labelCls}>
              {tipoConfig.col_evento} <span className="text-red-500">*</span>
            </label>
            <textarea
              name="descricao"
              rows={3}
              defaultValue={controle?.descricao ?? ""}
              placeholder={`Descreva ${tipoConfig.col_evento.toLowerCase()}...`}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100 resize-none"
            />
          </div>

          {/* Tipo Demanda */}
          <div>
            <label className={labelCls}>Tipo de Demanda</label>
            <select
              name="tipo_demanda"
              defaultValue={controle?.tipo_demanda ?? ""}
              className={selectCls}
            >
              <option value="">— Selecione —</option>
              {TIPOS_DEMANDA.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Status (edit only) */}
          {isEdit && (
            <div>
              <label className={labelCls}>Status</label>
              <select
                name="status"
                defaultValue={controle?.status ?? "pendente"}
                className={selectCls}
              >
                {Object.entries(STATUS_CONTROLE).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ── Observações ── */}
      <div className="rounded-xl border border-border bg-white p-5">
        <label className={labelCls}>Observações</label>
        <textarea
          name="observacoes"
          rows={4}
          defaultValue={controle?.observacoes ?? ""}
          placeholder="Informações adicionais..."
          className="w-full rounded-lg border border-border bg-white px-3 py-2 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100 resize-none"
        />
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="flex h-10 items-center gap-2 rounded-lg bg-primary px-6 font-body text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-60 cursor-pointer"
        >
          {pending && <SpinnerIcon className="h-4 w-4" />}
          {isEdit ? "Salvar alterações" : "Criar controle"}
        </button>
        <button
          type="button"
          onClick={() => router.push(`/dashboard/controles?tipo=${tipo}`)}
          className="h-10 rounded-lg border border-border px-4 font-body text-sm font-semibold text-fg transition-colors hover:border-primary hover:text-primary cursor-pointer"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
