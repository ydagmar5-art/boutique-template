export interface PixelConfig {
  meta: string; // Meta/Facebook Pixel ID
  tiktok: string; // TikTok Pixel ID
  snapchat: string; // Snap Pixel ID
  pinterest: string; // Pinterest Tag ID
  google: string; // Google Analytics 4, ex: G-XXXXXXX
  /*
    Google Ads est SÉPARÉ de GA4 : ce sont deux identifiants distincts, et une
    boutique a souvent les deux. Les fondre dans un seul champ obligerait à
    choisir — donc à perdre soit les statistiques, soit les conversions.
  */
  googleAds: string; // ID de conversion Google Ads, ex: AW-XXXXXXXXX
  /*
    ⚠️ Sans le libellé, l'ID Google Ads seul ne remonte AUCUN achat : gtag
    charge bien la balise, la régie voit le trafic, mais aucune conversion
    n'est enregistrée et les enchères automatiques restent aveugles. Les deux
    champs vont ensemble ou ne servent à rien.
  */
  googleAdsLabel: string; // Libellé de l'action de conversion, ex: AbC-D_efGh
  taboola: string; // Taboola account ID
}

export const EMPTY_PIXELS: PixelConfig = {
  meta: "",
  tiktok: "",
  snapchat: "",
  pinterest: "",
  google: "",
  googleAds: "",
  googleAdsLabel: "",
  taboola: "",
};

/**
 * Destination d'une conversion Google Ads : « AW-123456789/AbC-D_efGh ».
 *
 * Google affiche le couple sous cette forme dans l'extrait d'événement, et
 * c'est donc ce que les gens collent — le libellé seul comme le couple entier.
 * On accepte les deux plutôt que d'exiger la bonne moitié.
 */
export function googleAdsSendTo(p: Pick<PixelConfig, "googleAds" | "googleAdsLabel">): string {
  const id = p.googleAds.trim();
  // Ne garde que ce qui suit la barre oblique si le couple entier a été collé.
  const label = p.googleAdsLabel.trim().split("/").pop()?.trim() ?? "";
  return id && label ? `${id}/${label}` : "";
}
