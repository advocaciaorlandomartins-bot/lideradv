"use server";

import { redirect } from "next/navigation";
import sql from "./db";

export type ClientFormState = { error: string } | null;

export async function createClientAction(
  _prev: ClientFormState,
  formData: FormData
): Promise<ClientFormState> {
  const type = formData.get("type") as string;
  const name = ((formData.get("name") as string | null) ?? "").trim();
  const doc = ((formData.get("doc") as string | null) ?? "").trim();
  const tradeName =
    ((formData.get("trade_name") as string | null) ?? "").trim() || null;
  const birthDate = (formData.get("birth_date") as string | null) || null;
  const email = ((formData.get("email") as string | null) ?? "").trim();
  const phone = ((formData.get("phone") as string | null) ?? "").trim();
  const cep = ((formData.get("cep") as string | null) ?? "").trim();
  const street = ((formData.get("street") as string | null) ?? "").trim();
  const addrNumber = ((formData.get("number") as string | null) ?? "").trim();
  const complement =
    ((formData.get("complement") as string | null) ?? "").trim() || null;
  const neighborhood = (
    (formData.get("neighborhood") as string | null) ?? ""
  ).trim();
  const city = ((formData.get("city") as string | null) ?? "").trim();
  const state = formData.get("state") as string;
  const notes = ((formData.get("notes") as string | null) ?? "").trim() || null;

  if (!type || !name || !doc || !email || !phone) {
    return { error: "Preencha todos os campos obrigatórios." };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Informe um e-mail válido." };
  }

  if (!cep || !street || !addrNumber || !neighborhood || !city || !state) {
    return { error: "Preencha o endereço completo." };
  }

  try {
    await sql`
      INSERT INTO clients
        (type, name, doc, trade_name, birth_date, email, phone,
         cep, street, addr_number, complement, neighborhood,
         city, state, notes)
      VALUES
        (${type}, ${name}, ${doc}, ${tradeName},
         ${birthDate ? birthDate : null}::date,
         ${email}, ${phone}, ${cep}, ${street}, ${addrNumber},
         ${complement}, ${neighborhood}, ${city}, ${state}, ${notes})
    `;
  } catch (err) {
    console.error("createClientAction DB error:", err);
    return { error: "Erro ao salvar cliente. Tente novamente." };
  }

  redirect("/dashboard/clientes");
}

export async function updateClientAction(
  id: string,
  _prev: ClientFormState,
  formData: FormData
): Promise<ClientFormState> {
  const type = formData.get("type") as string;
  const name = ((formData.get("name") as string | null) ?? "").trim();
  const doc = ((formData.get("doc") as string | null) ?? "").trim();
  const tradeName =
    ((formData.get("trade_name") as string | null) ?? "").trim() || null;
  const birthDate = (formData.get("birth_date") as string | null) || null;
  const email = ((formData.get("email") as string | null) ?? "").trim();
  const phone = ((formData.get("phone") as string | null) ?? "").trim();
  const cep = ((formData.get("cep") as string | null) ?? "").trim();
  const street = ((formData.get("street") as string | null) ?? "").trim();
  const addrNumber = ((formData.get("number") as string | null) ?? "").trim();
  const complement =
    ((formData.get("complement") as string | null) ?? "").trim() || null;
  const neighborhood = (
    (formData.get("neighborhood") as string | null) ?? ""
  ).trim();
  const city = ((formData.get("city") as string | null) ?? "").trim();
  const state = formData.get("state") as string;
  const notes = ((formData.get("notes") as string | null) ?? "").trim() || null;
  const status = (formData.get("status") as string) || "ativo";

  if (!type || !name || !doc || !email || !phone) {
    return { error: "Preencha todos os campos obrigatórios." };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Informe um e-mail válido." };
  }

  if (!cep || !street || !addrNumber || !neighborhood || !city || !state) {
    return { error: "Preencha o endereço completo." };
  }

  try {
    await sql`
      UPDATE clients SET
        type         = ${type},
        name         = ${name},
        doc          = ${doc},
        trade_name   = ${tradeName},
        birth_date   = ${birthDate ? birthDate : null}::date,
        email        = ${email},
        phone        = ${phone},
        cep          = ${cep},
        street       = ${street},
        addr_number  = ${addrNumber},
        complement   = ${complement},
        neighborhood = ${neighborhood},
        city         = ${city},
        state        = ${state},
        notes        = ${notes},
        status       = ${status}
      WHERE id = ${id}::uuid
    `;
  } catch (err) {
    console.error("updateClientAction DB error:", err);
    return { error: "Erro ao atualizar cliente. Tente novamente." };
  }

  redirect(`/dashboard/clientes/${id}`);
}

export async function deleteClientAction(id: string): Promise<void> {
  try {
    await sql`DELETE FROM clients WHERE id = ${id}::uuid`;
  } catch (err) {
    console.error("deleteClientAction DB error:", err);
    return;
  }
  redirect("/dashboard/clientes");
}
