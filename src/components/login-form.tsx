"use client";

import { useActionState, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { loginAction, type LoginState } from "@/lib/auth-actions";
import { EyeIcon, EyeOffIcon, SpinnerIcon } from "@/components/icons";
import Image from "next/image";

export default function LoginForm() {
  const [state, formAction, isPending] = useActionState<LoginState, FormData>(
    loginAction,
    null
  );
  const [showSenha, setShowSenha] = useState(false);
  const searchParams = useSearchParams();
  const redefinido = searchParams.get("redefinido") === "1";

  return (
    <div className="w-full max-w-md">
      {/* Mobile: logo grande centralizada sobre fundo escuro */}
      <div className="lg:hidden flex justify-center mb-10">
        <Image
          src="/logo.png"
          alt="LiderAdv"
          width={160}
          height={160}
          className="rounded-3xl"
          priority
        />
      </div>

      {/* Heading — branco no mobile, azul escuro no desktop */}
      <div className="mb-8">
        <h1 className="font-body text-4xl font-extrabold leading-tight mb-2 text-white lg:text-[#001848]">
          Bem-vindo de volta.
        </h1>
        <p className="font-body text-base leading-relaxed text-[#8FBEFF] lg:text-[#005DFF]">
          Entre com sua conta para acessar o sistema.
        </p>
      </div>

      <form action={formAction} className="space-y-5" noValidate>
        {redefinido && (
          <div
            role="status"
            className="rounded-xl border px-4 py-3 font-body text-sm"
            style={{
              borderColor: "rgba(34,197,94,0.4)",
              background: "rgba(34,197,94,0.08)",
              color: "#16a34a",
            }}
          >
            ✅ Senha redefinida com sucesso. Faça login com a nova senha.
          </div>
        )}
        {state?.error && (
          <div
            role="alert"
            className="rounded-xl border border-red-400/30 bg-red-950/40 lg:bg-red-50 lg:border-red-200 px-4 py-3 font-body text-sm text-red-400 lg:text-red-600"
          >
            {state.error}
          </div>
        )}

        {/* Login */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="login"
            className="font-body text-sm font-bold text-white/80 lg:text-[#001848]"
          >
            Login
          </label>
          <input
            id="login"
            name="login"
            type="text"
            autoComplete="username"
            required
            placeholder="seu.login"
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

        {/* Senha */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="senha"
            className="font-body text-sm font-bold text-white/80 lg:text-[#001848]"
          >
            Senha
          </label>
          <div className="relative">
            <input
              id="senha"
              name="senha"
              type={showSenha ? "text" : "password"}
              autoComplete="current-password"
              required
              placeholder="••••••••"
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
              className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer rounded p-0.5 transition-colors duration-150 focus:outline-none"
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

        {/* Esqueci minha senha */}
        <div className="flex justify-end -mt-2">
          <Link
            href="/reset-senha"
            className="font-body text-xs font-semibold transition-colors duration-150"
            style={{ color: "#005DFF" }}
          >
            Esqueci minha senha
          </Link>
        </div>

        {/* Submit */}
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
              Entrando...
            </span>
          ) : (
            "Entrar"
          )}
        </button>
      </form>

      <p className="mt-6 text-center font-body text-xs leading-relaxed text-white/30 lg:text-[#7A94C1]">
        Sistema exclusivo para usuários autorizados.
        <br />
        Em caso de problemas, contate o administrador.
      </p>
    </div>
  );
}
