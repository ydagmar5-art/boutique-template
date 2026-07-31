import Link from "next/link";

/** Habillage commun des pages légales (typographie "prose" maison). */
export default function Legal({
  title,
  updated = "Dernière mise à jour : avril 2026",
  children,
}: {
  title: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
      <Link href="/" className="text-sm text-muted hover:text-ink">
        ← Accueil
      </Link>
      <h1 className="mt-4 font-heading text-4xl md:text-5xl">{title}</h1>
      <p className="mt-2 text-sm text-muted">{updated}</p>
      <article className="legal mt-10 space-y-6 leading-relaxed text-ink/85">
        {children}
      </article>
    </div>
  );
}
