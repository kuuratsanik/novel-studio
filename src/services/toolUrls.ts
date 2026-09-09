const ALLOWED_HOSTS = new Set(["toolsaday.com", "www.toolsaday.com"]);

export function isAllowedToolUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    return ALLOWED_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}
