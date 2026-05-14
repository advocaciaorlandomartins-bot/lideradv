"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { registerAction, type RegisterState } from "@/lib/auth-actions";
import { EyeIcon, EyeOffIcon, SpinnerIcon } from "@/components/icons";

const ESTADOS_OAB = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

function getStrength(password: string): { score: number; label: string } {
  if (!password) return { score: 0, label: "" };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 2) return { score: 1, label: "Fraca" };
  if (score <= 3) return { score: 2, label: "Média" };
  return { score: 3, label: "Forte" };
}

const strengthColor = ["", "bg-red-400", "bg-amber-400", "bg-green-500"];
const strengthText = ["", "text-red-500", "text-amber-500", "text-green-600"];

const inputClass =
  "h-12 w-full rounded-lg border border-border bg-white px-4 font-body text-base text-fg placeholder:text-slate-400 outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-blue-100 disabled:opacity-60";

const labelClass = "font-body text-sm font-semibold text-fg";

export default function RegisterForm() {
  const [state, formAction, isPending] = useActionState<
    RegisterState,
    FormData
  >(registerAction, null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPassword] = useState("");

  const strength = getStrength(password);

  return (
    <div className="w-full max-w-md">
      {/* Mobile brand header */}
      <div className="lg:hidden flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
          <svg
            className="w-5 h-5 text-white"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3v18" />
            <path d="M4 7h16" />
            <path d="M9 21h6" />
            <path d="M4 7L2 14L6 14Z" />
            <path d="M20 7L18 14L22 14Z" />
          </svg>
        </div>
        <span className="font-heading text-2xl font-semibold text-fg">
          AdvMartins
        </span>
      </div>

      {/* Heading */}
      <div className="mb-8">
        <h1 className="font-heading text-4xl font-semibold text-fg leading-tight mb-2">
          Crie sua conta.
        </h1>
        <p className="font-body text-base text-muted leading-relaxed">
          Preencha os dados abaixo para acessar o sistema.
        </p>
      </div>

      <form action={formAction} className="space-y-5" noValidate>
        {/* Error */}
        {state && "error" in state && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-body text-sm text-red-700"
          >
            {state.error}
          </div>
        )}

        {/* Nome */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className={labelClass}>
            Nome completo
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            placeholder="Dr. Orlando Martins"
            disabled={isPending}
            className={inputClass}
          />
        </div>

        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className={labelClass}>
            E-mail profissional
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="seu@email.com.br"
            disabled={isPending}
            className={inputClass}
          />
        </div>

        {/* OAB */}
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Inscrição na OAB</label>
          <div className="flex gap-2">
            <select
              name="oab_estado"
              required
              disabled={isPending}
              aria-label="Estado da OAB"
              defaultValue=""
              className="h-12 w-28 flex-shrink-0 rounded-lg border border-border bg-white px-3 font-body text-base text-fg outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-blue-100 disabled:opacity-60 cursor-pointer"
            >
              <option value="" disabled>
                UF
              </option>
              {ESTADOS_OAB.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
            <input
              name="oab_numero"
              type="text"
              inputMode="numeric"
              required
              placeholder="Nº de inscrição"
              disabled={isPending}
              maxLength={6}
              className={`${inputClass} flex-1`}
            />
          </div>
          <p className="font-body text-xs text-muted">
            Usado para busca automática de processos nos portais da Justiça.
          </p>
        </div>

        {/* Senha */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className={labelClass}>
            Senha
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              placeholder="Mínimo 8 caracteres"
              disabled={isPending}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputClass} pr-12`}
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

          {/* Strength bar */}
          {password && (
            <div className="flex items-center gap-2 mt-1">
              <div className="flex flex-1 gap-1">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors duration-200 ${
                      strength.score >= i
                        ? strengthColor[strength.score]
                        : "bg-slate-200"
                    }`}
                  />
                ))}
              </div>
              <span
                className={`font-body text-xs font-semibold ${strengthText[strength.score]}`}
              >
                {strength.label}
              </span>
            </div>
          )}
        </div>

        {/* Confirmar senha */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirm_password" className={labelClass}>
            Confirmar senha
          </label>
          <div className="relative">
            <input
              id="confirm_password"
              name="confirm_password"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              required
              placeholder="Repita a senha"
              disabled={isPending}
              className={`${inputClass} pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              aria-label={
                showConfirm ? "Ocultar confirmação" : "Mostrar confirmação"
              }
              className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer rounded p-0.5 text-muted transition-colors duration-150 hover:text-fg focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              {showConfirm ? (
                <EyeOffIcon className="h-5 w-5" />
              ) : (
                <EyeIcon className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {/* Termos */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            name="terms"
            type="checkbox"
            required
            disabled={isPending}
            className="mt-0.5 h-4 w-4 flex-shrink-0 cursor-pointer rounded border-border accent-primary"
          />
          <span className="font-body text-sm text-muted leading-relaxed">
            Li e aceito os{" "}
            <a
              href="/termos"
              className="text-primary hover:text-primary-dark transition-colors duration-150"
            >
              Termos de Uso
            </a>{" "}
            e a{" "}
            <a
              href="/privacidade"
              className="text-primary hover:text-primary-dark transition-colors duration-150"
            >
              Política de Privacidade
            </a>
            .
          </span>
        </label>

        {/* Submit */}
        <button
          type="submit"
          disabled={isPending}
          className="mt-1 h-12 w-full cursor-pointer rounded-lg bg-cta px-6 font-body text-base font-semibold text-white transition-colors duration-150 hover:bg-cta-hover focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? (
            <span className="flex items-center justify-center gap-2">
              <SpinnerIcon className="h-4 w-4" />
              Criando conta...
            </span>
          ) : (
            "Criar conta"
          )}
        </button>
      </form>

      {/* Link para login */}
      <p className="mt-6 text-center font-body text-sm text-muted">
        Já tem conta?{" "}
        <Link
          href="/"
          className="font-semibold text-primary hover:text-primary-dark transition-colors duration-150"
        >
          Entrar
        </Link>
      </p>
    </div>
  );
}
