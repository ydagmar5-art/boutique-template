"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { brand } from "@/config/brand.config";
import { useCart, cartCount } from "@/lib/cart/store";
import Logo from "./Logo";

export default function Navbar() {
  const lines = useCart((s) => s.lines);
  const open = useCart((s) => s.open);
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const count = mounted ? cartCount(lines) : 0;

  return (
    <header
      className={`sticky top-0 z-40 transition-colors duration-300 ${
        scrolled
          ? "border-b border-line bg-bg/85 backdrop-blur-md"
          : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Logo />
        <nav className="hidden items-center gap-8 md:flex">
          {brand.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group relative text-sm text-muted transition-colors hover:text-ink"
            >
              {item.label}
              <span className="absolute -bottom-1 left-0 h-px w-0 bg-primary transition-all duration-300 group-hover:w-full" />
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <button
            onClick={open}
            className="group inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm text-ink transition-all hover:border-primary hover:shadow-glow"
          >
            Panier
            <span
              className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-medium transition-colors ${
                count > 0 ? "bg-primary text-white" : "bg-bg text-muted"
              }`}
            >
              {count}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
