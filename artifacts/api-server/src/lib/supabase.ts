export class LibraryError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function booksRequest(query: string, init: RequestInit = {}): Promise<unknown> {
  const base = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_ANON_KEY?.trim();
  if (!base || !key) throw new LibraryError(503, "Add SUPABASE_URL and SUPABASE_ANON_KEY to project Secrets.");
  let url: URL;
  try {
    url = new URL(base);
    if (url.protocol !== "https:") throw new Error();
  } catch {
    throw new LibraryError(503, "SUPABASE_URL must be your HTTPS Supabase project URL.");
  }
  url.pathname = "/rest/v1/library_demo_books";
  url.search = query;
  const headers: Record<string, string> = {
    apikey: key,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
  // New publishable keys are API keys, not JWT bearer tokens.
  if (!key.startsWith("sb_publishable_")) headers.Authorization = `Bearer ${key}`;
  let response: globalThis.Response;
  try {
    response = await fetch(url, { ...init, headers, signal: AbortSignal.timeout(10000) });
  } catch {
    throw new LibraryError(503, "Could not reach Supabase. Check your project URL and that the project is active.");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const code = data && typeof data === "object" && "code" in data ? data.code : undefined;
    if (code === "PGRST205" || code === "42P01") {
      throw new LibraryError(503, "Create the demo books table by running the setup SQL in Supabase.");
    }
    if (response.status === 401 || response.status === 403) {
      throw new LibraryError(503, "Supabase denied access. Check your anon/public key and run the setup SQL to enable demo permissions.");
    }
    throw new LibraryError(502, "Supabase could not complete the request. Check the demo table schema and permissions.");
  }
  return data;
}
