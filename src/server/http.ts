import "server-only";
import { LedgerError } from "@/core/ledger";

/** Run a handler; turn known errors into JSON, and never echo internals. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    // Matched by name as well: after a dev hot reload the long-lived ledger can throw an older copy of the class.
    if (error instanceof LedgerError || (error instanceof Error && error.name === "LedgerError")) {
      const status = (error as LedgerError).status;
      return Response.json({ error: error.message }, { status: typeof status === "number" ? status : 400 });
    }
    // Log the error type only — request bodies can contain receipt contents.
    console.error("[shareback] request failed:", error instanceof Error ? error.name : "unknown");
    return Response.json({ error: "Something went wrong on our side." }, { status: 500 });
  }
}

/** Mutations must come from this site's own pages. */
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) throw new LedgerError(403, "Cross-site request refused.");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new LedgerError(403, "Cross-site request refused.");
  }
  if (originHost !== host) throw new LedgerError(403, "Cross-site request refused.");
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new LedgerError(400, "Invalid request body.");
  }
}
