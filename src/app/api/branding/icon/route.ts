import { NextRequest, NextResponse } from "next/server";
import { getIconPng } from "@/lib/branding";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sizeParam = Number(req.nextUrl.searchParams.get("size"));
  const size = Math.min(Math.max(sizeParam || 512, 16), 1024);
  const buf = await getIconPng(size);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=300, must-revalidate",
    },
  });
}
