/** Logos de moyens de paiement (SVG légers, sans dépendance). */

function Card({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <span
      aria-label={label}
      className="inline-flex h-7 w-11 items-center justify-center rounded-md border border-line bg-white"
    >
      {children}
    </span>
  );
}

export default function PaymentBadges() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Visa */}
      <Card label="Visa">
        <svg viewBox="0 0 48 16" className="h-3.5">
          <text
            x="24"
            y="13"
            textAnchor="middle"
            fontFamily="Arial, sans-serif"
            fontWeight="700"
            fontStyle="italic"
            fontSize="14"
            fill="#1A1F71"
            letterSpacing="1"
          >
            VISA
          </text>
        </svg>
      </Card>

      {/* Mastercard */}
      <Card label="Mastercard">
        <svg viewBox="0 0 40 24" className="h-4">
          <circle cx="16" cy="12" r="9" fill="#EB001B" />
          <circle cx="24" cy="12" r="9" fill="#F79E1B" />
          <path
            d="M20 5a9 9 0 0 1 0 14 9 9 0 0 1 0-14Z"
            fill="#FF5F00"
          />
        </svg>
      </Card>

      {/* American Express */}
      <Card label="American Express">
        <svg viewBox="0 0 48 16" className="h-3">
          <rect width="48" height="16" rx="2" fill="#2E77BC" />
          <text
            x="24"
            y="11"
            textAnchor="middle"
            fontFamily="Arial, sans-serif"
            fontWeight="700"
            fontSize="8"
            fill="#fff"
            letterSpacing="0.5"
          >
            AMEX
          </text>
        </svg>
      </Card>

      {/* Carte Bleue */}
      <Card label="Carte Bancaire">
        <svg viewBox="0 0 40 24" className="h-4">
          <path d="M4 6h26a6 6 0 0 1 0 12H10A6 6 0 0 1 4 6Z" fill="#16366F" />
          <path d="M22 6h8a6 6 0 0 1 0 12h-8a8 8 0 0 0 0-12Z" fill="#3C8C3F" />
        </svg>
      </Card>
    </div>
  );
}
