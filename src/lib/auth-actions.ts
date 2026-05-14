"use server";

import { redirect } from "next/navigation";

export type LoginState = { error: string } | null;

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = ((formData.get("email") as string | null) ?? "").trim();
  const password = (formData.get("password") as string | null) ?? "";

  if (!email || !password) {
    return { error: "Preencha o e-mail e a senha para continuar." };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { error: "Informe um e-mail válido." };
  }

  // TODO: verificar credenciais no banco Neon
  redirect("/dashboard");
}
