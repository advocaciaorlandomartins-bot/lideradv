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

export type RegisterState = { error: string } | { success: true } | null;

export async function registerAction(
  _prevState: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const name = ((formData.get("name") as string | null) ?? "").trim();
  const email = ((formData.get("email") as string | null) ?? "").trim();
  const oabEstado = (formData.get("oab_estado") as string | null) ?? "";
  const oabNumero = (
    (formData.get("oab_numero") as string | null) ?? ""
  ).trim();
  const password = (formData.get("password") as string | null) ?? "";
  const confirmPassword =
    (formData.get("confirm_password") as string | null) ?? "";

  if (
    !name ||
    !email ||
    !oabEstado ||
    !oabNumero ||
    !password ||
    !confirmPassword
  ) {
    return { error: "Preencha todos os campos obrigatórios." };
  }

  if (name.trim().split(/\s+/).length < 2) {
    return { error: "Informe nome e sobrenome." };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { error: "Informe um e-mail válido." };
  }

  if (!/^\d{4,6}$/.test(oabNumero)) {
    return { error: "O número da OAB deve ter entre 4 e 6 dígitos." };
  }

  if (password.length < 8) {
    return { error: "A senha deve ter pelo menos 8 caracteres." };
  }

  if (password !== confirmPassword) {
    return { error: "As senhas não coincidem." };
  }

  // TODO: criar usuário no banco Neon e verificar duplicidade de e-mail/OAB
  redirect("/dashboard");
}
