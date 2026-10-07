import { getIconPng } from "@/lib/branding";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

export default async function AppleIcon() {
  const buf = await getIconPng(180);
  return new Response(new Uint8Array(buf), {
    headers: { "Content-Type": "image/png" },
  });
}
