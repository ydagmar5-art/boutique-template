import { listContacts } from "@/lib/actions/contacts";
import ContactsTable from "@/components/admin/ContactsTable";

export const dynamic = "force-dynamic";

export default async function AdminContacts() {
  const contacts = await listContacts();
  const inscrites = contacts.filter((c) => c.statut !== "cliente").length;
  const clientes = contacts.filter((c) => c.statut !== "inscrite").length;

  return (
    <div>
      <header className="mb-8">
        <h1 className="font-heading text-3xl">Contacts</h1>
        <p className="text-sm text-muted">
          {contacts.length} adresses · {clientes} cliente
          {clientes > 1 ? "s" : ""} · {inscrites} inscrite
          {inscrites > 1 ? "s" : ""} à la lettre
        </p>
      </header>

      <ContactsTable contacts={contacts} />

      <p className="mt-6 max-w-3xl text-xs leading-relaxed text-muted">
        L&apos;export suit le filtre affiché. Pour une campagne commerciale,
        privilégiez « Lettre » et « Clientes + lettre » : ce sont les adresses
        qui ont demandé à recevoir vos e-mails. Les clientes qui n&apos;ont pas
        souscrit ne peuvent être démarchées que sur des produits analogues à
        leur achat, et chaque envoi doit comporter un lien de désinscription.
      </p>
    </div>
  );
}
