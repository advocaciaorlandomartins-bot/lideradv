import { getIconPng } from "@/lib/branding";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

export default async function Icon() {
  const buf = await getIconPng(32);
  return new Response(new Uint8Array(buf), {
    headers: { "Content-Type": "image/png" },
  });
}
