import { NextResponse } from "next/server";
import { db } from "@/db";
import { teams } from "@/db/schema";

export async function GET() {
  try {
    const rows = await db.select().from(teams).orderBy(teams.name);
    return NextResponse.json({ teams: rows });
  } catch (err) {
    console.error("Teams API error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
