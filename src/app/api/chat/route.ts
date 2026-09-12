import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const backendUrl = process.env.PYTHON_BACKEND_URL?.replace(/\/$/, "");

  if (!backendUrl) {
    return NextResponse.json(
      { error: "The Python chat service is not configured. Add PYTHON_BACKEND_URL." },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(`${backendUrl}/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(await request.json()),
      cache: "no-store",
    });
    if (!response.ok || !response.body) {
      const payload = await response.json().catch(() => ({ error: "The Python chat service returned an invalid response." }));
      if (payload.detail && !payload.error) payload.error = payload.detail;
      return NextResponse.json(payload, { status: response.status });
    }

    return new NextResponse(response.body, {
      status: response.status,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Python chat service error:", error);
    return NextResponse.json(
      { error: "The Python chat service is unavailable. Please try again shortly." },
      { status: 502 },
    );
  }
}
