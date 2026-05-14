"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { loginAction, type LoginState } from "@/lib/auth-actions";
import {
  EyeIcon,
  EyeOffIcon,
  ScalesIcon,
  SpinnerIcon,
} from "@/components/icons";

export default function LoginForm() {
  const [state, formAction, isPending] = useActionState<LoginState, FormData>(
    loginAction,
    null
  );
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="w-full max-w-md">
      {/* Mobile: compact brand header */}
      <div className="lg:hidden flex items-center gap-3 mb-10">
        <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
          <ScalesIcon className="w-5 h-5 text-white" />
        </div>
        <span className="font-heading text-2xl font-semibold text-fg">
          AdvMartins
        </span>
      </div>

      {/* Heading */}
      <div className="mb-8">
        <h1 className="font-heading text-4xl font-semibold text-fg leading-tight mb-2">
          Bem-vindo de volta.
        </h1>
        <p className="font-body text-base text-muted leading-relaxed">
          Entre com sua conta para acessar o sistema.
        </p>
      </div>

      <form action={formAction} className="space-y-5" noValidate>
        {/* Error message */}
        {state?.error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-body text-sm text-red-700"
          >
            {state.error}
          </div>
        )}

        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="email"
            className="font-body text-sm font-semibold text-fg"
          >
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="seu@email.com.br"
            disabled={isPending}
            className="h-12 w-full rounded-lg border border-border bg-white px-4 font-body text-base text-fg placeholder:text-slate-400 outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
          />
        </div>

        {/* Password */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="font-body text-sm font-semibold text-fg"
            >
              Senha
            </label>
            <a
              href="/recuperar-senha"
              className="font-body text-sm text-primary hover:text-primary-dark transition-colors duration-150 cursor-pointer"
            >
              Esqueci minha senha
            </a>
          </div>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              placeholder="••••••••"
              disabled={isPending}
              className="h-12 w-full rounded-lg border border-border bg-white px-4 pr-12 font-body text-base text-fg placeholder:text-slate-400 outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer rounded p-0.5 text-muted transition-colors duration-150 hover:text-fg focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              {showPassword ? (
                <EyeOffIcon className="h-5 w-5" />
              ) : (
                <EyeIcon className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isPending}
          className="mt-2 h-12 w-full cursor-pointer rounded-lg bg-cta px-6 font-body text-base font-semibold text-white transition-colors duration-150 hover:bg-cta-hover focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
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

      <p className="mt-6 text-center font-body text-sm text-muted">
        Não tem conta?{" "}
        <Link
          href="/registro"
          className="font-semibold text-primary hover:text-primary-dark transition-colors duration-150"
        >
          Criar conta
        </Link>
      </p>

      <p className="mt-4 text-center font-body text-xs leading-relaxed text-muted">
        Sistema exclusivo para advogados autorizados.
        <br />
        Em caso de problemas, contate o administrador.
      </p>
    </div>
  );
}
