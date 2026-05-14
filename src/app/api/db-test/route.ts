import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET() {
  const result = await sql`SELECT NOW() as time, version() as version`;
  return NextResponse.json({ connected: true, ...result[0] });
}
