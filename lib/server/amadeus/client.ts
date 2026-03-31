const DEFAULT_HOST = "https://test.api.amadeus.com";

function host() {
  return (process.env.AMADEUS_HOST ?? DEFAULT_HOST).replace(/\/$/, "");
}

let tokenCache: { accessToken: string; expiresAt: number } | null = null;

export async function getAmadeusToken(): Promise<string | null> {
  const id = process.env.AMADEUS_API_KEY ?? "";
  const secret = process.env.AMADEUS_API_SECRET ?? "";
  if (!id || !secret) return null;

  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 5000) {
    return tokenCache.accessToken;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: id,
    client_secret: secret,
  });

  const res = await fetch(`${host()}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    tokenCache = null;
    return null;
  }

  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) return null;

  tokenCache = {
    accessToken: data.access_token,
    expiresAt: now + (data.expires_in ?? 1700) * 1000,
  };
  return tokenCache.accessToken;
}

export async function amadeusGet(path: string, query: Record<string, string | number | undefined>) {
  const token = await getAmadeusToken();
  if (!token) return { ok: false as const, status: 401, data: null as unknown };

  const url = new URL(path.startsWith("http") ? path : `${host()}${path}`);
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  });

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) return { ok: false as const, status: res.status, data };
  return { ok: true as const, status: res.status, data };
}
