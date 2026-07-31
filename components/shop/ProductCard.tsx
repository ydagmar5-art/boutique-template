import Link from "next/link";
import { brand } from "@/config/brand.config";
import { formatPrice, type Product } from "@/lib/products";

export default function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex flex-col"
    >
      <div className="relative overflow-hidden rounded-xl2 bg-surface">
        <div className="absolute inset-0 z-10 bg-gradient-to-t from-ink/10 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.images[0]}
          alt={product.name}
          loading="lazy"
          decoding="async"
          width={640}
          height={800}
          className="aspect-[4/5] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        />
        <span className="absolute left-4 top-4 z-20 rounded-full bg-bg/85 px-3 py-1 text-xs font-medium text-muted backdrop-blur">
          {product.collection}
        </span>
      </div>
      <div className="flex items-start justify-between gap-3 px-1 pt-4">
        <div>
          <h3 className="font-heading text-lg leading-tight">{product.name}</h3>
          <p className="mt-0.5 text-sm text-muted">{product.tagline}</p>
        </div>
        <span className="whitespace-nowrap pt-1 text-sm font-medium">
          {formatPrice(product.price, brand.currency, brand.locale)}
        </span>
      </div>
    </Link>
  );
}
