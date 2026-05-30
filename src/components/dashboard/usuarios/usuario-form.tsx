"use client";

import { useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { SpinnerIcon, EyeIcon, EyeOffIcon } from "@/components/icons";
import {
  createUsuarioAction,
  updateUsuarioAction,
  type UsuarioFormState,
} from "@/lib/usuarios-actions";
import {
  CATEGORIAS,
  type Usuario,
  type ColaboradorOption,
} from "@/lib/usuarios-types";
import {
  MODULOS,
  ACOES,
  DEFAULTS_POR_CATEGORIA,
  resolvePermissoes,
  isSubModulo,
  type Permissoes,
} from "@/lib/permissoes";

const inputCls =
  "w-full h-10 rounded-lg border border-border bg-white px-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100";
const labelCls = "block font-body text-sm font-semibold text-fg mb-1.5";
const selectCls =
  "w-full h-10 cursor-pointer rounded-lg border border-border bg-white px-3 font-body text-sm text-fg outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100";

interface Props {
  usuario?: Usuario;
  colaboradores: ColaboradorOption[];
}

function buildInitialPerms(usuario?: Usuario): Permissoes {
  const cat = usuario?.categoria ?? "Colaborador(a)";
  return resolvePermissoes(cat, usuario?.permissoes ?? null);
}

export default function UsuarioForm({ usuario, colaboradores }: Props) {
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
  const [categoria, setCategoria] = useState(usuario?.categoria ?? "");
  const [colaboradorId, setColaboradorId] = useState(
    usuario?.colaborador_id ?? ""
  );
  const [perms, setPerms] = useState<Permissoes>(buildInitialPerms(usuario));

  function handleCategoriaChange(cat: string) {
    setCategoria(cat);
    if (cat) setPerms(resolvePermissoes(cat, null));
  }

  function togglePerm(mod: string, acao: string) {
    setPerms((prev) => {
      const current = prev[mod] ?? [];
      const willHave = !current.includes(acao);
      const next = willHave
        ? [...current, acao]
        : current.filter((a) => a !== acao);
      const updated: Permissoes = { ...prev, [mod]: next };

      // Quando altera VER de um módulo pai: cascateia para os sub-módulos
      if (acao === "ver") {
        for (const { key, parent } of MODULOS) {
          if (parent === mod) {
            const sub = prev[key] ?? [];
            updated[key] = willHave
              ? sub.includes("ver")
                ? sub
                : ["ver"]
              : sub.filter((a) => a !== "ver");
          }
        }
      }
      return updated;
    });
  }

  function setModuleAll(mod: string, checked: boolean) {
    setPerms((prev) => {
      const updated: Permissoes = {
        ...prev,
        [mod]: checked ? ACOES.map((a) => a.key) : [],
      };
      // Cascateia VER para sub-módulos
      for (const { key, parent } of MODULOS) {
        if (parent === mod) {
          const sub = prev[key] ?? [];
          updated[key] = checked
            ? sub.includes("ver")
              ? sub
              : ["ver"]
            : sub.filter((a) => a !== "ver");
        }
      }
      return updated;
    });
  }

  function resetToDefaults() {
    if (!categoria) return;
    setPerms(resolvePermissoes(categoria, null));
  }

  if (state?.success && !isEdit) {
    router.push("/dashboard/usuarios");
  }

  return (
    <form action={formAction} className="flex flex-col gap-6 max-w-3xl">
      {isEdit && <input type="hidden" name="id" value={usuario.id} />}
      <input type="hidden" name="ativo" value={String(ativo)} />

      {/* hidden permissoes fields */}
      {MODULOS.map(({ key: mod, parent }) => {
        // Sub-módulos só têm VER; módulos pai têm todas as ações
        const acoes = parent !== null ? [{ key: "ver" }] : ACOES;
        return acoes.map(({ key: acao }) =>
          (perms[mod] ?? []).includes(acao) ? (
            <input
              key={`${mod}_${acao}`}
              type="hidden"
              name={`perm_${mod}_${acao}`}
              value="on"
            />
          ) : null
        );
      })}

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

      {/* ── Dados de acesso ── */}
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
            <p className="mt-1 font-body text-xs text-muted">Sem espaços.</p>
          </div>

          <div>
            <label className={labelCls}>
              Nome completo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="nome"
              value={
                colaboradorId
                  ? (colaboradores.find((c) => c.id === colaboradorId)?.nome ??
                    "")
                  : undefined
              }
              defaultValue={usuario?.nome ?? ""}
              required
              readOnly={!!colaboradorId}
              placeholder="Nome do usuário"
              className={`${inputCls} ${colaboradorId ? "bg-slate-50 text-muted" : ""}`}
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

      {/* ── Perfil e vigência ── */}
      <div className="rounded-xl border border-border bg-white p-5 space-y-4">
        <h2 className="font-heading text-sm font-semibold text-fg">
          Perfil e vigência
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls}>Colaborador vinculado</label>
            <select
              name="colaborador_id"
              value={colaboradorId}
              onChange={(e) => setColaboradorId(e.target.value)}
              className={selectCls}
            >
              <option value="">— Nenhum —</option>
              {colaboradores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} ({c.cargo})
                </option>
              ))}
            </select>
            <p className="mt-1 font-body text-xs text-muted">
              Vincule ao colaborador correspondente para sincronizar o nome.
            </p>
          </div>

          <div>
            <label className={labelCls}>
              Categoria <span className="text-red-500">*</span>
            </label>
            <select
              name="categoria"
              value={categoria}
              onChange={(e) => handleCategoriaChange(e.target.value)}
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
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${ativo ? "bg-emerald-500" : "bg-slate-300"}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${ativo ? "translate-x-6" : "translate-x-1"}`}
                />
              </button>
              <span className="ml-3 font-body text-sm text-fg">
                {ativo ? "Ativo" : "Inativo"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Permissões ── */}
      <div className="rounded-xl border border-border bg-white p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading text-sm font-semibold text-fg">
              Permissões de acesso
            </h2>
            <p className="mt-0.5 font-body text-xs text-muted">
              Sub-itens indentados controlam seções específicas dentro do
              módulo.
            </p>
          </div>
          <button
            type="button"
            onClick={resetToDefaults}
            className="font-body text-xs text-primary hover:underline cursor-pointer"
          >
            Restaurar padrões da categoria
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-2 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted w-52">
                  Módulo / Seção
                </th>
                {ACOES.map(({ label }) => (
                  <th
                    key={label}
                    className="pb-2 text-center font-body text-xs font-semibold uppercase tracking-wide text-muted w-20"
                  >
                    {label}
                  </th>
                ))}
                <th className="pb-2 text-center font-body text-xs font-semibold uppercase tracking-wide text-muted w-16">
                  Todos
                </th>
              </tr>
            </thead>
            <tbody>
              {MODULOS.map(({ key: mod, label: modLabel, parent }) => {
                const modPerms = perms[mod] ?? [];
                const isSub = parent !== null;

                if (isSub) {
                  return (
                    <tr
                      key={mod}
                      className="bg-slate-50/60 hover:bg-slate-100/60"
                    >
                      <td className="py-1.5 pl-7 pr-4">
                        <span className="flex items-center gap-1.5 font-body text-xs text-muted">
                          <span className="select-none text-slate-300 font-mono">
                            └
                          </span>
                          {modLabel}
                        </span>
                      </td>
                      {/* VER */}
                      <td className="py-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={modPerms.includes("ver")}
                          onChange={() => togglePerm(mod, "ver")}
                          className="h-4 w-4 cursor-pointer rounded border-border text-primary accent-primary"
                          title={`Controlar visibilidade de "${modLabel}"`}
                        />
                      </td>
                      {/* Criar / Editar / Excluir / Todos — desabilitados para sub-módulos */}
                      <td className="py-1.5 text-center">
                        <span className="inline-block h-4 w-4 rounded border border-dashed border-slate-200" />
                      </td>
                      <td className="py-1.5 text-center">
                        <span className="inline-block h-4 w-4 rounded border border-dashed border-slate-200" />
                      </td>
                      <td className="py-1.5 text-center">
                        <span className="inline-block h-4 w-4 rounded border border-dashed border-slate-200" />
                      </td>
                      <td className="py-1.5" />
                    </tr>
                  );
                }

                // Módulo pai
                const allChecked = ACOES.every(({ key: a }) =>
                  modPerms.includes(a)
                );
                const hasSubModulos = MODULOS.some((m) => m.parent === mod);
                return (
                  <tr
                    key={mod}
                    className={`hover:bg-slate-50 border-t border-border ${hasSubModulos ? "bg-white" : ""}`}
                  >
                    <td className="py-2.5 font-body text-sm text-fg font-semibold">
                      {modLabel}
                    </td>
                    {ACOES.map(({ key: acao }) => (
                      <td key={acao} className="py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={modPerms.includes(acao)}
                          onChange={() => togglePerm(mod, acao)}
                          className="h-4 w-4 cursor-pointer rounded border-border text-primary accent-primary"
                        />
                      </td>
                    ))}
                    <td className="py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={allChecked}
                        onChange={(e) => setModuleAll(mod, e.target.checked)}
                        className="h-4 w-4 cursor-pointer rounded border-border text-primary accent-primary"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 p-3">
          <span className="mt-0.5 text-blue-500 flex-shrink-0 font-bold text-xs">
            ℹ
          </span>
          <p className="font-body text-xs text-blue-700 leading-relaxed">
            Sub-itens (indentados) controlam seções específicas do módulo pai.
            Marcar/desmarcar <strong>VER</strong> no módulo pai cascateia
            automaticamente para todos os sub-itens. Usuários precisam sair e
            entrar novamente para que as alterações de permissão tenham efeito.
          </p>
        </div>

        <p className="font-body text-xs text-muted">
          Ao mudar a categoria, as permissões são redefinidas para o padrão
          dela.
        </p>
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
