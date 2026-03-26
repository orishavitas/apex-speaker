import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    phase: "1-foundation",
    version: "0.1.0",
    notebooklm: "https://notebooklm.google.com/notebook/59cf7942-cf9f-459e-9b3c-46b0702f026c",
  });
}
