import Script from "next/script";
import type { PixelConfig } from "@/lib/pixels-types";

/**
 * Injecte les pixels publicitaires configurés dans le back-office.
 * Chaque script n'est chargé que si son identifiant est renseigné.
 */
export default function PixelScripts({ pixels }: { pixels: PixelConfig }) {
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

      {pixels.google && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${pixels.google}`}
            strategy="afterInteractive"
          />
          <Script id="px-google" strategy="afterInteractive">{`
window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('js',new Date());gtag('config','${pixels.google}');`}</Script>
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
