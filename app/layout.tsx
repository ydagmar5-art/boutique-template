import type { Metadata } from "next";
import { brand, brandCssVars } from "@/config/brand.config";
import { fontVariables } from "@/config/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${brand.name} — ${brand.tagline}`,
    template: `%s · ${brand.name}`,
  },
  description: brand.description,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang={brand.locale.split("-")[0]} className={fontVariables}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: brandCssVars() }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
