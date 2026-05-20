const LOCAL_FALLBACK = "http://localhost:3000";

function normalize(url: string | undefined | null): string | null {
  if (!url) {
    return null;
  }
  const trimmed = url.replace(/\/+$/, "");
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export function getClientBaseUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  return normalize(process.env.NEXT_PUBLIC_LIVE_URL) ?? LOCAL_FALLBACK;
}

export function getServerBaseUrl(req?: Request): string {
  if (req) {
    const host =
      req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (host) {
      const proto =
        req.headers.get("x-forwarded-proto") ??
        (host.startsWith("localhost") || host.startsWith("127.0.0.1")
          ? "http"
          : "https");
      return `${proto}://${host}`;
    }
  }

  const envOverride = normalize(process.env.NEXT_PUBLIC_LIVE_URL);
  if (envOverride) {
    return envOverride;
  }

  const vercelUrl = normalize(process.env.VERCEL_URL);
  if (vercelUrl) {
    return vercelUrl;
  }

  return LOCAL_FALLBACK;
}
