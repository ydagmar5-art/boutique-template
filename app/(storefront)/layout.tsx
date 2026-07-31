import Navbar from "@/components/site/Navbar";
import Footer from "@/components/site/Footer";
import CartDrawer from "@/components/site/CartDrawer";
import Tracker from "@/components/site/Tracker";
import PixelScripts from "@/components/site/PixelScripts";
import RouteChangePixel from "@/components/site/RouteChangePixel";
import StripePreload from "@/components/shop/StripePreload";
import { getPixels } from "@/lib/actions/pixels";
import { getGateways } from "@/lib/actions/settings";

export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // En parallèle : les deux lectures tapent le même store, autant ne pas les
  // enchaîner.
  const [pixels, gateways] = await Promise.all([getPixels(), getGateways()]);
  const stripeKey = gateways.stripe?.enabled
    ? gateways.stripe.values?.publicKey
    : undefined;

  return (
    <>
      {/* Ouvre DNS + TLS vers Stripe avant même qu'on ait besoin du script. */}
      {stripeKey && (
        <link rel="preconnect" href="https://js.stripe.com" crossOrigin="" />
      )}
      <Navbar />
      <main className="min-h-screen">{children}</main>
      <Footer />
      <CartDrawer />
      <Tracker />
      <PixelScripts pixels={pixels} />
      <RouteChangePixel />
      {stripeKey && <StripePreload publishableKey={stripeKey} />}
    </>
  );
}
