import Script from "next/script";
import { googleAdsSendTo, type PixelConfig } from "@/lib/pixels-types";

/**
 * Injecte les pixels publicitaires configurés dans le back-office.
 * Chaque script n'est chargé que si son identifiant est renseigné.
 */
export default function PixelScripts({
  pixels,
  achatServeur = false,
}: {
  pixels: PixelConfig;
  /**
   * L'achat part du SERVEUR (Measurement Protocol) : le navigateur ne doit
   * plus l'envoyer, sinon il est compté deux fois. Calculé côté serveur par
   * le gabarit (`suiviServeurActif()`), ce composant étant rendu côté client
   * après consentement.
   */
  achatServeur?: boolean;
}) {
  /*
    ╔════════════════════════════════════════════════════════════════╗
    ║  AUCUN PIXEL HORS PRODUCTION                                   ║
    ╚════════════════════════════════════════════════════════════════╝

    ⚠️ Le 20/09/2026, un test lancé en local a envoyé un ACHAT de 64 € dans
    le Google Analytics de la boutique : la même vente y est apparue deux
    fois, et le chiffre d'affaires du jour était faux. Une session de
    développement ne doit jamais toucher les statistiques réelles.

    Le site local et les aperçus Vercel ne chargent donc plus aucun pixel.
    Pour mesurer quelque chose, on teste en production, sur une page qui ne
    déclenche pas d'achat.
  */
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") return null;
  if (!process.env.VERCEL_ENV && process.env.NODE_ENV !== "production") return null;

  const sendTo = googleAdsSendTo(pixels);
  return (
    <>
      {pixels.meta && (
        <Script id="px-meta" strategy="afterInteractive">{`
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${pixels.meta}');fbq('track','PageView');`}</Script>
      )}

      {pixels.tiktok && (
        <Script id="px-tiktok" strategy="afterInteractive">{`
!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];
ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";
ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;
var o=d.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;
var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
ttq.load('${pixels.tiktok}');ttq.page()}(window,document,'ttq');`}</Script>
      )}

      {pixels.snapchat && (
        <Script id="px-snap" strategy="afterInteractive">{`
(function(e,t,n){if(e.snaptr)return;var a=e.snaptr=function(){
a.handleRequest?a.handleRequest.apply(a,arguments):a.queue.push(arguments)};
a.queue=[];var s='script';var r=t.createElement(s);r.async=!0;
r.src=n;var u=t.getElementsByTagName(s)[0];u.parentNode.insertBefore(r,u)})
(window,document,'https://sc-static.net/scevent.min.js');
snaptr('init','${pixels.snapchat}');snaptr('track','PAGE_VIEW');`}</Script>
      )}

      {pixels.pinterest && (
        <Script id="px-pinterest" strategy="afterInteractive">{`
!function(e){if(!window.pintrk){window.pintrk=function(){
window.pintrk.queue.push(Array.prototype.slice.call(arguments))};var n=window.pintrk;
n.queue=[],n.version="3.0";var t=document.createElement("script");t.async=!0,
t.src=e;var r=document.getElementsByTagName("script")[0];
r.parentNode.insertBefore(t,r)}}("https://s.pinimg.com/ct/core.js");
pintrk('load','${pixels.pinterest}');pintrk('page');`}</Script>
      )}

      {/*
        GA4 et Google Ads partagent la MÊME balise gtag.js : on la charge une
        seule fois, puis on déclare chaque identifiant par un `config`. Charger
        deux fois le script écraserait la file `dataLayer` en cours de route.
      */}
      {(pixels.google || pixels.googleAds) && (
        <>
          {/*
            ⚠️ LE SCRIPT EST DEMANDÉ PAR L'IDENTIFIANT GOOGLE ADS EN PRIORITÉ.

            Constaté le 18/09/2026 : `gtag/js?id=G-…` d'une boutique répondait 404. La
            balise Analytics a été regroupée dans la balise Google Ads
            AW-…, qui porte désormais les deux destinations (son
            script contient le G-). Demander le script par le G- ne
            chargeait RIEN : aucune vue, aucun panier, aucun achat ne partait,
            ni vers Analytics ni vers Google Ads — `gtag` restait une simple
            file d'attente que personne ne lisait.

            Pour vérifier après tout changement de compte :
            curl -s -o /dev/null -w '%{http_code}' \
              'https://www.googletagmanager.com/gtag/js?id=<ID>'  → doit valoir 200
          */}
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${pixels.googleTag || pixels.googleAds || pixels.google}`}
            strategy="afterInteractive"
          />
          <Script id="px-google" strategy="afterInteractive">{`
window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('js',new Date());
${
  /* ⚠️ Avec une balise Google (GT-), c'est ELLE qu'on configure : elle active
     ses destinations, dont l'ID de mesure GA4. Configurer le G- directement
     fait redemander son script propre, qui répond 404 : GA4 ne reçoit alors
     rien (constaté le 18/09/2026). */
  pixels.googleTag
    ? `gtag('config',${JSON.stringify(pixels.googleTag)});`
    : pixels.google
      ? `gtag('config',${JSON.stringify(pixels.google)});`
      : ""
}
${pixels.googleAds ? `gtag('config',${JSON.stringify(pixels.googleAds)});` : ""}
${
  /* La destination de conversion est posée ici plutôt que passée en accessoire
     jusqu'à la page de confirmation : elle vient du back-office, et la faire
     traverser trois composants pour un seul usage n'apporterait rien. */
  sendTo ? `window.__pxGoogleAdsSendTo=${JSON.stringify(sendTo)};` : ""
}${
  /* ⚠️ ANTI-DOUBLON. Quand le serveur envoie lui-même l'achat à Analytics
     (cf. `lib/analytics/ga-serveur.ts`), le navigateur ne doit PAS l'envoyer
     une seconde fois : le chiffre d'affaires serait compté deux fois. Les
     autres régies (Meta, Snap, Pinterest) continuent, elles, de recevoir
     l'achat depuis la page de confirmation. */
  achatServeur ? "window.__pxAchatServeur=true;" : ""
}`}</Script>
        </>
      )}

      {pixels.taboola && (
        <Script id="px-taboola" strategy="afterInteractive">{`
window._tfa=window._tfa||[];
window._tfa.push({notify:'event',name:'page_view',id:${JSON.stringify(pixels.taboola)}});
!function(t,f,a,x){if(!document.getElementById(x)){t.async=1;t.src=a;t.id=x;
f.parentNode.insertBefore(t,f);}}(document.createElement('script'),
document.getElementsByTagName('script')[0],
'https://cdn.taboola.com/libtrc/unip/${pixels.taboola}/tfa.js','tb_tfa_script');`}</Script>
      )}
    </>
  );
}
