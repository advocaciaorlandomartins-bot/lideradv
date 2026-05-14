"use server";

import { redirect } from "next/navigation";

export type ClientFormState = { error: string } | null;

export async function createClientAction(
  _prev: ClientFormState,
  formData: FormData
): Promise<ClientFormState> {
  const type = formData.get("type") as string;
  const name = ((formData.get("name") as string | null) ?? "").trim();
  const doc = ((formData.get("doc") as string | null) ?? "").trim();
  const email = ((formData.get("email") as string | null) ?? "").trim();
  const phone = ((formData.get("phone") as string | null) ?? "").trim();
  const cep = ((formData.get("cep") as string | null) ?? "").trim();
  const street = ((formData.get("street") as string | null) ?? "").trim();
  const number = ((formData.get("number") as string | null) ?? "").trim();
  const city = ((formData.get("city") as string | null) ?? "").trim();
  const state = formData.get("state") as string;

  if (!type || !name || !doc || !email || !phone) {
    return { error: "Preencha todos os campos obrigatórios." };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { error: "Informe um e-mail válido." };
  }

  if (!cep || !street || !number || !city || !state) {
    return { error: "Preencha o endereço completo." };
  }

  // TODO: inserir no banco Neon
  // await sql`INSERT INTO clients (...) VALUES (...)`;

  console.log("Novo cliente:", { type, name, doc, email, phone, city, state });

  redirect("/dashboard/clientes");
}
