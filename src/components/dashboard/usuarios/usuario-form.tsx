"use client";

import { useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { SpinnerIcon, EyeIcon, EyeOffIcon } from "@/components/icons";
import {
  createUsuarioAction,
  updateUsuarioAction,
  type UsuarioFormState,
} from "@/lib/usuarios-actions";
import { CATEGORIAS, type Usuario } from "@/lib/usuarios-db";

const inputCls =
  "w-full h-10 rounded-lg border border-border bg-white px-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100";
const labelCls = "block font-body text-sm font-semibold text-fg mb-1.5";
const selectCls =
  "w-full h-10 cursor-pointer rounded-lg border border-border bg-white px-3 font-body text-sm text-fg outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100";

interface Props {
  usuario?: Usuario;
}

export default function UsuarioForm({ usuario }: Props) {
  const isEdit = !!usuario;
  const router = useRouter();

  const action = isEdit ? updateUsuarioAction : createUsuarioAction;
  const [state, formAction, pending] = useActionState<
    UsuarioFormState,
    FormData
  >(action, null);

  const [showSenha, setShowSenha] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [ativo, setAtivo] = useState(usuario?.ativo ?? true);

  if (state?.success && !isEdit) {
    router.push("/dashboard/usuarios");
  }

  return (
    <form action={formAction} className="flex flex-col gap-6 max-w-2xl">
      {isEdit && <input type="hidden" name="id" value={usuario.id} />}
      <input type="hidden" name="ativo" value={String(ativo)} />

      {state?.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-body text-sm text-red-700">
          {state.error}
        </div>
      )}
      {state?.success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 font-body text-sm text-emerald-700">
          {isEdit
            ? "Usuário atualizado com sucesso."
            : "Usuário criado com sucesso."}
        </div>
      )}

      {/* ── Dados do usuário ── */}
      <div className="rounded-xl border border-border bg-white p-5 space-y-4">
        <h2 className="font-heading text-sm font-semibold text-fg">
          Dados de acesso
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>
              Login <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="login"
              defaultValue={usuario?.login ?? ""}
              required
              autoComplete="off"
              placeholder="ex: orlando"
              className={inputCls}
            />
            <p className="mt-1 font-body text-xs text-muted">
              Apenas letras, números e ponto. Sem espaços.
            </p>
          </div>

          <div>
            <label className={labelCls}>
              Nome completo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="nome"
              defaultValue={usuario?.nome ?? ""}
              required
              placeholder="Nome do usuário"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>
              {isEdit ? "Nova senha" : "Senha"}{" "}
              {!isEdit && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
              <input
                type={showSenha ? "text" : "password"}
                name="senha"
                autoComplete="new-password"
                placeholder={
                  isEdit ? "Deixe em branco para manter" : "Mínimo 6 caracteres"
                }
                className={`${inputCls} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowSenha((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg"
              >
                {showSenha ? (
                  <EyeOffIcon className="h-4 w-4" />
                ) : (
                  <EyeIcon className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label className={labelCls}>
              Confirmar senha{" "}
              {!isEdit && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
              <input
                type={showConf ? "text" : "password"}
                name="senha_confirmacao"
                autoComplete="new-password"
                placeholder="Repita a senha"
                className={`${inputCls} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowConf((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg"
              >
                {showConf ? (
                  <EyeOffIcon className="h-4 w-4" />
                ) : (
                  <EyeIcon className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Perfil e acesso ── */}
      <div className="rounded-xl border border-border bg-white p-5 space-y-4">
        <h2 className="font-heading text-sm font-semibold text-fg">
          Perfil e vigência
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>
              Categoria <span className="text-red-500">*</span>
            </label>
            <select
              name="categoria"
              defaultValue={usuario?.categoria ?? ""}
              required
              className={selectCls}
            >
              <option value="">— Selecione —</option>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Validade do acesso</label>
            <input
              type="date"
              name="validade"
              defaultValue={usuario?.validade?.slice(0, 10) ?? ""}
              className={inputCls}
            />
            <p className="mt-1 font-body text-xs text-muted">
              Deixe em branco para acesso sem prazo.
            </p>
          </div>

          {isEdit && (
            <div className="sm:col-span-2">
              <label className={labelCls}>Status</label>
              <button
                type="button"
                role="switch"
                aria-checked={ativo}
                onClick={() => setAtivo((v) => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  ativo ? "bg-emerald-500" : "bg-slate-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    ativo ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
              <span className="ml-3 font-body text-sm text-fg">
                {ativo ? "Ativo" : "Inativo"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="flex h-10 items-center gap-2 rounded-lg bg-primary px-6 font-body text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-60 cursor-pointer"
        >
          {pending && <SpinnerIcon className="h-4 w-4" />}
          {isEdit ? "Salvar alterações" : "Criar usuário"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/dashboard/usuarios")}
          className="h-10 rounded-lg border border-border px-4 font-body text-sm font-semibold text-fg transition-colors hover:border-primary hover:text-primary cursor-pointer"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
