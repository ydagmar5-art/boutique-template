export interface PixelConfig {
  meta: string; // Meta/Facebook Pixel ID
  tiktok: string; // TikTok Pixel ID
  snapchat: string; // Snap Pixel ID
  pinterest: string; // Pinterest Tag ID
  google: string; // Google (GA4 / Ads) ID, ex: G-XXXX ou AW-XXXX
  taboola: string; // Taboola account ID
}

export const EMPTY_PIXELS: PixelConfig = {
  meta: "",
  tiktok: "",
  snapchat: "",
  pinterest: "",
  google: "",
  taboola: "",
};
