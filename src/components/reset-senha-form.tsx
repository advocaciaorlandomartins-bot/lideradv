"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  requestPasswordResetAction,
  resetPasswordAction,
  type ResetRequestState,
  type ResetPasswordState,
} from "@/lib/auth-actions";
import { EyeIcon, EyeOffIcon, SpinnerIcon } from "@/components/icons";
import Image from "next/image";

/* ── Solicitar link de reset ── */
function SolicitarForm() {
  const [state, formAction, isPending] = useActionState<
    ResetRequestState,
    FormData
  >(requestPasswordResetAction, null);

  if (state && "success" in state) {
    return (
      <div className="text-center">
        <div
          className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full"
          style={{ background: "rgba(0,93,255,0.12)" }}
        >
          <span style={{ fontSize: 32 }}>📬</span>
        </div>
        <h2
          className="font-body text-2xl font-bold mb-3"
          style={{ color: "#001848" }}
        >
          Verifique seu e-mail
        </h2>
        <p
          className="font-body text-sm leading-relaxed mb-6"
          style={{ color: "#5A6A85" }}
        >
          Se esse e-mail estiver cadastrado, você receberá um link para
          redefinir sua senha nos próximos minutos.
        </p>
        <Link
          href="/login"
          className="font-body text-sm font-semibold"
          style={{ color: "#005DFF" }}
        >
          ← Voltar para o login
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1
        className="font-body text-3xl font-extrabold leading-tight mb-2"
        style={{ color: "#001848" }}
      >
        Esqueci minha senha
      </h1>
      <p
        className="font-body text-sm leading-relaxed mb-8"
        style={{ color: "#5A6A85" }}
      >
        Informe o e-mail cadastrado e enviaremos um link para redefinir sua
        senha.
      </p>

      <form action={formAction} className="space-y-5" noValidate>
        {state && "error" in state && (
          <div
            role="alert"
            className="rounded-xl border px-4 py-3 font-body text-sm"
            style={{
              borderColor: "#fca5a5",
              background: "#fef2f2",
              color: "#dc2626",
            }}
          >
            {state.error}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="email"
            className="font-body text-sm font-bold"
            style={{ color: "#001848" }}
          >
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="seu@email.com"
            disabled={isPending}
            className="h-12 w-full rounded-xl px-4 font-body text-base outline-none transition-colors duration-150 disabled:opacity-60"
            style={{
              background: "#FFFFFF",
              border: "1.5px solid #CBD8F0",
              color: "#001848",
            }}
            onFocus={(e) =>
              (e.currentTarget.style.border = "1.5px solid #005DFF")
            }
            onBlur={(e) =>
              (e.currentTarget.style.border = "1.5px solid #CBD8F0")
            }
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="mt-2 h-12 w-full cursor-pointer px-6 font-body text-base font-bold text-white transition-all duration-150 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          style={{ background: "#005DFF", borderRadius: "50px" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#0047CC")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#005DFF")}
        >
          {isPending ? (
            <span className="flex items-center justify-center gap-2">
              <SpinnerIcon className="h-4 w-4" />
              Enviando...
            </span>
          ) : (
            "Enviar link de redefinição"
          )}
        </button>
      </form>

      <p
        className="mt-6 text-center font-body text-sm"
        style={{ color: "#5A6A85" }}
      >
        Lembrou a senha?{" "}
        <Link
          href="/login"
          className="font-semibold"
          style={{ color: "#005DFF" }}
        >
          Voltar para o login
        </Link>
      </p>
    </>
  );
}

/* ── Redefinir senha com token ── */
function RedefinirForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState<
    ResetPasswordState,
    FormData
  >(resetPasswordAction, null);
  const [showSenha, setShowSenha] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);

  if (state && "success" in state) {
    return (
      <div className="text-center">
        <div
          className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full"
          style={{ background: "rgba(22,163,74,0.12)" }}
        >
          <span style={{ fontSize: 32 }}>✅</span>
        </div>
        <h2
          className="font-body text-2xl font-bold mb-3"
          style={{ color: "#001848" }}
        >
          Senha redefinida!
        </h2>
        <p
          className="font-body text-sm leading-relaxed mb-6"
          style={{ color: "#5A6A85" }}
        >
          Sua senha foi alterada com sucesso. Faça login com a nova senha.
        </p>
        <Link
          href="/login"
          className="font-body text-sm font-semibold"
          style={{ color: "#005DFF" }}
        >
          Ir para o login →
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1
        className="font-body text-3xl font-extrabold leading-tight mb-2"
        style={{ color: "#001848" }}
      >
        Nova senha
      </h1>
      <p
        className="font-body text-sm leading-relaxed mb-8"
        style={{ color: "#5A6A85" }}
      >
        Escolha uma nova senha para sua conta.
      </p>

      <form action={formAction} className="space-y-5" noValidate>
        <input type="hidden" name="token" value={token} />

        {state && "error" in state && (
          <div
            role="alert"
            className="rounded-xl border px-4 py-3 font-body text-sm"
            style={{
              borderColor: "#fca5a5",
              background: "#fef2f2",
              color: "#dc2626",
            }}
          >
            {state.error}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="senha"
            className="font-body text-sm font-bold"
            style={{ color: "#001848" }}
          >
            Nova senha
          </label>
          <div className="relative">
            <input
              id="senha"
              name="senha"
              type={showSenha ? "text" : "password"}
              autoComplete="new-password"
              required
              placeholder="Mínimo 8 caracteres"
              disabled={isPending}
              className="h-12 w-full rounded-xl px-4 pr-12 font-body text-base outline-none transition-colors duration-150 disabled:opacity-60"
              style={{
                background: "#FFFFFF",
                border: "1.5px solid #CBD8F0",
                color: "#001848",
              }}
              onFocus={(e) =>
                (e.currentTarget.style.border = "1.5px solid #005DFF")
              }
              onBlur={(e) =>
                (e.currentTarget.style.border = "1.5px solid #CBD8F0")
              }
            />
            <button
              type="button"
              onClick={() => setShowSenha((v) => !v)}
              aria-label={showSenha ? "Ocultar senha" : "Mostrar senha"}
              className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer rounded p-0.5"
              style={{ color: "#005DFF" }}
            >
              {showSenha ? (
                <EyeOffIcon className="h-5 w-5" />
              ) : (
                <EyeIcon className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="confirmar"
            className="font-body text-sm font-bold"
            style={{ color: "#001848" }}
          >
            Confirmar nova senha
          </label>
          <div className="relative">
            <input
              id="confirmar"
              name="confirmar"
              type={showConfirmar ? "text" : "password"}
              autoComplete="new-password"
              required
              placeholder="Repita a senha"
              disabled={isPending}
              className="h-12 w-full rounded-xl px-4 pr-12 font-body text-base outline-none transition-colors duration-150 disabled:opacity-60"
              style={{
                background: "#FFFFFF",
                border: "1.5px solid #CBD8F0",
                color: "#001848",
              }}
              onFocus={(e) =>
                (e.currentTarget.style.border = "1.5px solid #005DFF")
              }
              onBlur={(e) =>
                (e.currentTarget.style.border = "1.5px solid #CBD8F0")
              }
            />
            <button
              type="button"
              onClick={() => setShowConfirmar((v) => !v)}
              aria-label={showConfirmar ? "Ocultar senha" : "Mostrar senha"}
              className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer rounded p-0.5"
              style={{ color: "#005DFF" }}
            >
              {showConfirmar ? (
                <EyeOffIcon className="h-5 w-5" />
              ) : (
                <EyeIcon className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="mt-2 h-12 w-full cursor-pointer px-6 font-body text-base font-bold text-white transition-all duration-150 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          style={{ background: "#005DFF", borderRadius: "50px" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#0047CC")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#005DFF")}
        >
          {isPending ? (
            <span className="flex items-center justify-center gap-2">
              <SpinnerIcon className="h-4 w-4" />
              Salvando...
            </span>
          ) : (
            "Salvar nova senha"
          )}
        </button>
      </form>
    </>
  );
}

/* ── Página principal ── */
export default function ResetSenhaForm({ token }: { token: string | null }) {
  return (
    <div className="h-screen overflow-hidden flex flex-col lg:flex-row">
      {/* Painel esquerdo — mesmo padrão do login */}
      <aside
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, #000D25 0%, #001848 60%, #003080 100%)",
        }}
      >
        <div className="relative flex flex-col justify-center items-center w-full h-full p-10 gap-8">
          <Image
            src="/logo.png"
            alt="LiderAdv"
            width={200}
            height={200}
            className="rounded-3xl"
            priority
          />
          <div className="text-center">
            <h2 className="font-body text-2xl font-bold text-white mb-3">
              Recuperação de acesso
            </h2>
            <p className="font-body text-base text-[#8FBEFF]/80 leading-relaxed max-w-xs mx-auto">
              Enviaremos um link seguro para o e-mail cadastrado. O link expira
              em 1 hora.
            </p>
          </div>
        </div>
      </aside>

      {/* Painel direito — formulário */}
      <main className="flex flex-1 items-center justify-center p-8 lg:w-1/2 overflow-auto">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex justify-center mb-10">
            <Image
              src="/logo.png"
              alt="LiderAdv"
              width={140}
              height={140}
              className="rounded-3xl"
              priority
            />
          </div>

          {token ? <RedefinirForm token={token} /> : <SolicitarForm />}
        </div>
      </main>
    </div>
  );
}
