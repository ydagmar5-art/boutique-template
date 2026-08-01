"use client";

import { useRouter } from "next/navigation";
import { brand } from "@/config/brand.config";
import ImageUploader from "@/components/admin/ImageUploader";
import { useState, useTransition } from "react";
import { saveProduct } from "@/lib/actions/products";
import type { Product, ProductVariant } from "@/lib/products";

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

type VariantDraft = { id: string; label: string; priceEuros: string; stock: string };

export default function ProductForm({
  product,
  categories,
}: {
  product?: Product;
  categories: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const isEdit = !!product;

  const [name, setName] = useState(product?.name ?? "");
  const [tagline, setTagline] = useState(product?.tagline ?? "");
  const [price, setPrice] = useState(product ? String(product.price / 100) : "");
  const [collection, setCollection] = useState(
    product?.collection ?? categories[0] ?? "",
  );
  const [material, setMaterial] = useState(product?.material ?? "");
  const [detail, setDetail] = useState(product?.detail ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [featured, setFeatured] = useState(product?.featured ?? false);
  const [manageStock, setManageStock] = useState(product?.manageStock ?? false);
  const [hidden, setHidden] = useState(product?.hidden ?? false);
  const [variants, setVariants] = useState<VariantDraft[]>(
    product?.variants.map((v) => ({
      id: v.id,
      label: v.label,
      priceEuros: String(v.priceDelta / 100),
      stock: String(v.stock),
    })) ?? [{ id: "standard", label: "Standard", priceEuros: "0", stock: "10" }],
  );

  const setVariant = (i: number, patch: Partial<VariantDraft>) =>
    setVariants((vs) => vs.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));

  const submit = () => {
    const slug = product?.slug ?? slugify(name);
    if (!slug) return;
    const built: Product = {
      slug,
      name,
      tagline,
      price: Math.round(parseFloat(price || "0") * 100),
      collection,
      material,
      detail,
      description,
      images,
      featured,
      manageStock,
      hidden,
      variants: variants.map<ProductVariant>((v) => ({
        id: v.id || slugify(v.label) || "v",
        label: v.label,
        priceDelta: Math.round(parseFloat(v.priceEuros || "0") * 100),
        stock: parseInt(v.stock || "0", 10),
      })),
    };
    start(async () => {
      await saveProduct(built);
      router.push("/admin/products");
      router.refresh();
    });
  };

  const field =
    "w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm outline-none focus:border-primary";

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Label text="Nom">
          <input className={field} value={name} onChange={(e) => setName(e.target.value)} />
        </Label>
        <Label text="Sous-titre">
          <input className={field} value={tagline} onChange={(e) => setTagline(e.target.value)} />
        </Label>
        <Label text="Prix (€)">
          <input className={field} type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Label>
        <Label text="Catégorie">
          <select className={field} value={collection} onChange={(e) => setCollection(e.target.value)}>
            {!categories.includes(collection) && collection && (
              <option value={collection}>{collection}</option>
            )}
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Label>
        <Label text="Matières">
          <input className={field} value={material} onChange={(e) => setMaterial(e.target.value)} />
        </Label>
        <Label text={brand.productDetailLabel}>
          <input className={field} value={detail} onChange={(e) => setDetail(e.target.value)} />
        </Label>
      </div>

      <Label text="Description">
        <textarea className={`${field} min-h-24`} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Label>

      <ImageUploader value={images} onChange={setImages} />

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="accent-primary" />
        Mettre en avant sur la page d&apos;accueil
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={manageStock} onChange={(e) => setManageStock(e.target.checked)} className="accent-primary" />
        Gérer le stock de ce produit
        <span className="text-xs text-muted">
          (si décoché, le stock n&apos;est pas affiché au client et le produit est toujours disponible)
        </span>
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} className="accent-primary" />
        Masquer ce produit de la boutique
        <span className="text-xs text-muted">
          (il reste dans le back-office, mais devient introuvable pour les clients)
        </span>
      </label>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-muted">Variantes / finitions</p>
          <button
            onClick={() => setVariants((vs) => [...vs, { id: "", label: "", priceEuros: "0", stock: "0" }])}
            className="text-sm text-primary-dark hover:underline"
          >
            + Ajouter
          </button>
        </div>
        <div className="space-y-2">
          {variants.map((v, i) => (
            <div key={i} className="flex items-center gap-2">
              <input className={`${field} flex-1`} placeholder="Finition" value={v.label} onChange={(e) => setVariant(i, { label: e.target.value })} />
              <input className={`${field} w-28`} type="number" step="0.01" placeholder="Surcoût €" value={v.priceEuros} onChange={(e) => setVariant(i, { priceEuros: e.target.value })} />
              {manageStock && (
                <input className={`${field} w-24`} type="number" placeholder="Stock" value={v.stock} onChange={(e) => setVariant(i, { stock: e.target.value })} />
              )}
              <button onClick={() => setVariants((vs) => vs.filter((_, idx) => idx !== i))} className="px-2 text-muted hover:text-secondary" aria-label="Retirer">✕</button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-line pt-5">
        <button
          onClick={submit}
          disabled={pending || !name}
          className="rounded-full bg-ink px-7 py-3 text-sm font-medium text-bg hover:bg-primary-dark disabled:opacity-50"
        >
          {pending ? "Enregistrement…" : isEdit ? "Enregistrer" : "Créer le produit"}
        </button>
        <button onClick={() => router.push("/admin/products")} className="text-sm text-muted hover:text-ink">
          Annuler
        </button>
      </div>
    </div>
  );
}

function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{text}</span>
      {children}
    </label>
  );
}
