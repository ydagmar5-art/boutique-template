"use client";

import { useState, useTransition } from "react";
import { subscribeToNewsletter } from "@/lib/actions/newsletter";

/**
 * Inscription à la lettre de la maison.
 *
 * ⚠️ Le modèle livrait un formulaire NON BRANCHÉ, qui ne faisait rien au
 * clic. Celui-ci appelle une vraie action serveur, enregistre l'adresse et
 * déclenche l'e-mail de bienvenue avec le code.
 *
 * Une adresse déjà inscrite reçoit un message neutre et AUCUN nouvel e-mail :
 * renvoyer le code à chaque soumission ferait de ce champ une machine à
 * spammer, jeton de réputation compris.
 */
export default function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ton: "ok" | "erreur"; texte: string } | null>(null);

  const envoyer = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage(null);
    start(async () => {
      const res = await subscribeToNewsletter(email);
      if (res.error) return setMessage({ ton: "erreur", texte: res.error });
      if (res.already)
        return setMessage({
          ton: "ok",
          texte: "Cette adresse est déjà inscrite. À très vite.",
        });
      setEmail("");
      setMessage({
        ton: "ok",
        texte: "Merci. Votre code de bienvenue vient de partir par e-mail.",
      });
    });
  };

  return (
    <div>
      <form
        onSubmit={envoyer}
        className="mx-auto flex max-w-md flex-col gap-3 sm:flex-row"
      >
        <label className="sr-only" htmlFor="newsletter-email">
          Votre adresse e-mail
        </label>
        <input
          id="newsletter-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Votre adresse e-mail"
          disabled={pending}
          className="flex-1 border border-line bg-bg px-5 py-[0.95rem] text-sm outline-none transition placeholder:text-muted focus:border-ink disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={pending}
          className="bg-ink px-8 py-[0.95rem] text-[0.66rem] uppercase tracking-[0.22em] text-bg transition-colors hover:bg-primary-dark disabled:opacity-50"
        >
          {pending ? "Envoi…" : "S'inscrire"}
        </button>
      </form>

      <p
        aria-live="polite"
        className={`mt-4 min-h-[1.25rem] text-[0.72rem] ${
          message?.ton === "erreur" ? "text-secondary" : "text-muted"
        }`}
      >
        {message?.texte ?? ""}
      </p>
    </div>
  );
}
