/**
 * Referral links (Master: Refer a Friend) — `/r/CODE` (general link) and
 * `/r/CODE?deal=<campaign id>` (a specific product deal). Older `?ref=CODE`
 * links still work. Captured on arrival and
 * sent with registration. Also a stable per-browser device id for fraud
 * checks (Master #51), sent as `X-Device-Id`.
 */

const REF_KEY = "nibbl-referral";
const DEVICE_KEY = "nibbl-device-id";

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode etc.: referral/device id simply aren't remembered.
  }
};

export const rememberReferral = (code: string, deal: string | null) => {
  if (code.trim()) write(REF_KEY, JSON.stringify({ code: code.trim().toUpperCase(), deal: deal || null }));
};

export const captureReferral = () => {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const code = params.get("ref");
  if (code) rememberReferral(code, params.get("deal"));
};

export const storedReferral = (): { code: string; deal: string | null } | null => {
  const raw = read(REF_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const clearReferral = () => {
  try {
    localStorage.removeItem(REF_KEY);
  } catch {
    // ignore
  }
};

export const referralLink = (code: string, campaignId?: string) => {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/r/${encodeURIComponent(code)}${campaignId ? `?deal=${encodeURIComponent(campaignId)}` : ""}`;
};

export const deviceId = (): string => {
  if (typeof window === "undefined") return "";
  let id = read(DEVICE_KEY);
  if (!id) {
    id = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    write(DEVICE_KEY, id);
  }
  return id;
};
