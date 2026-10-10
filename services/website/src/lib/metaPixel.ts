/**
 * Meta Pixel (Master #11): fires Campaign View, Claim and Approved Redemption
 * to the brand's own Pixel, only for campaigns where the brand turned tracking
 * on. The backend sends just a validated numeric Pixel ID (`meta_pixel_id`) —
 * brands can't supply scripts; the only script loaded is Meta's own
 * fbevents.js. Browser-side only (no Conversions API / Advanced Matching at
 * launch).
 */

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  loaded: boolean;
  version: string;
  push: Fbq;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

const PIXEL_ID = /^\d{15,16}$/;
const initialized = new Set<string>();

const ensureLoaded = (): Fbq | null => {
  if (typeof window === "undefined") return null;
  if (!window.fbq) {
    // Meta's standard loader stub: queue calls until fbevents.js arrives.
    const fbq = function (...args: unknown[]) {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue.push(args);
    } as Fbq;
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.queue = [];
    window.fbq = fbq;
    window._fbq = fbq;
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);
  }
  return window.fbq;
};

export type PixelEvent = "CampaignView" | "Claim" | "ApprovedRedemption";

export const trackPixel = (pixelId: unknown, event: PixelEvent, params: Record<string, unknown> = {}) => {
  if (typeof pixelId !== "string" || !PIXEL_ID.test(pixelId)) return;
  try {
    const fbq = ensureLoaded();
    if (!fbq) return;
    if (!initialized.has(pixelId)) {
      // No automatic page/button tracking — only the three Master events.
      fbq("set", "autoConfig", false, pixelId);
      fbq("init", pixelId);
      initialized.add(pixelId);
    }
    // trackSingle keeps each brand's events on that brand's pixel only.
    fbq("trackSingleCustom", pixelId, event, params);
  } catch {
    // Tracking must never break the shopper flow.
  }
};

const firedKey = "nibbl-pixel-redemptions";
const APPROVED_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Approved Redemption is decided on the server, so it fires the next time
 *  the shopper's redemptions load — once per redemption, recent ones only. */
export const trackApprovedRedemptions = (redemptions: Record<string, unknown>[]) => {
  let fired: string[] = [];
  try {
    fired = JSON.parse(localStorage.getItem(firedKey) || "[]");
  } catch {
    fired = [];
  }
  const now = Date.now();
  let changed = false;
  for (const redemption of redemptions) {
    const id = String(redemption.id ?? "");
    const issuedAt = Date.parse(String(redemption.issued_at ?? redemption.created_at ?? ""));
    if (!id || !redemption.meta_pixel_id || fired.includes(id)) continue;
    if (Number.isNaN(issuedAt) || now - issuedAt > APPROVED_WINDOW_MS) continue;
    trackPixel(redemption.meta_pixel_id, "ApprovedRedemption", {
      campaign_id: redemption.campaign,
      value: Number(redemption.reward_amount ?? 0),
      currency: "USD",
    });
    fired.push(id);
    changed = true;
  }
  if (changed) {
    try {
      localStorage.setItem(firedKey, JSON.stringify(fired.slice(-500)));
    } catch {
      // Per-browser only.
    }
  }
};
