import { getRpcUrl, NETWORK } from "@/lib/chain-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.text();
  const upstream = getRpcUrl(NETWORK);

  try {
    const response = await fetch(upstream, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body,
      cache: "no-store",
    });

    return new Response(await response.text(), {
      status: response.status,
      headers: {
        "content-type":
          response.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to reach Sui RPC";
    console.error("[MANDATE] Sui RPC proxy failed", {
      network: NETWORK,
      rpcUrl: upstream,
      error: message,
    });

    return Response.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32000,
          message,
        },
      },
      { status: 502 },
    );
  }
}
