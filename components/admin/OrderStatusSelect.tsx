"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOrderStatus } from "@/lib/actions/orders";
import type { OrderStatus, OrderTracking } from "@/lib/db/seed";
import ShippingDialog from "@/components/admin/ShippingDialog";

const OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: "pending", label: "En attente" },
  { value: "paid", label: "Payée" },
  // Étape intermédiaire : la commande est préparée mais pas encore remise
  // au transporteur. Elle déclenche son propre e-mail.
  { value: "processing", label: "Traitée" },
  { value: "shipped", label: "Expédiée" },
  { value: "cancelled", label: "Annulée" },
  { value: "refunded", label: "Remboursée" },
];

export default function OrderStatusSelect({
  id,
  status,
  tracking,
}: {
  id: string;
  status: OrderStatus;
  tracking?: OrderTracking;
}) {
  const router = useRouter();
  const [value, setValue] = useState<OrderStatus>(status);
  const [asking, setAsking] = useState(false);
  const [pending, start] = useTransition();
  const selectRef = useRef<HTMLSelectElement>(null);

  const apply = (next: OrderStatus, tr?: OrderTracking) => {
    setValue(next);
    start(async () => {
      await updateOrderStatus(id, next, tr);
      router.refresh();
    });
  };

  // Le select affiche « Expédiée » pendant la saisie ; on le remet en place si
  // l'admin annule (React ne restaure pas le DOM quand l'état ne change pas).
  const cancel = () => {
    setAsking(false);
    if (selectRef.current) selectRef.current.value = value;
  };

  return (
    <>
      <select
        ref={selectRef}
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as OrderStatus;
          // L'expédition passe par le formulaire de suivi : rien n'est
          // enregistré tant que l'admin n'a pas validé.
          if (next === "shipped") {
            setAsking(true);
            return;
          }
          apply(next);
        }}
        className="rounded-lg border border-line bg-bg px-2.5 py-1.5 text-xs outline-none focus:border-primary disabled:opacity-50"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {asking && (
        <ShippingDialog
          orderId={id}
          initial={tracking}
          pending={pending}
          onCancel={cancel}
          onSubmit={(tr) => {
            setAsking(false);
            apply("shipped", tr);
          }}
        />
      )}
    </>
  );
}
