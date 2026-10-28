/** Sample look card: the shape of what Wingman returns, using the products in the hero render. */
const ITEMS = [
  { slot: "Shirt", name: "Camp Collar Shirt, Retro Spade", store: "DUXTON", price: 136.25 },
  { slot: "Trousers", name: "Basic Pants, Dark Grey", store: "DUXTON", price: 158.05 },
  { slot: "Hair", name: "Modern slick back", store: "Grooming", price: 0 },
];

const SCORE = 8.6;

function ScoreRing({ score }: { score: number }) {
  const r = 26;
  const circumference = 2 * Math.PI * r;
  return (
    <div className="relative grid size-16 shrink-0 place-items-center">
      <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth="5" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="url(#ring)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - score / 10)}
        />
        <defs>
          <linearGradient id="ring" x1="0" x2="1">
            <stop offset="0" stopColor="#e3c78d" />
            <stop offset="1" stopColor="#c8a96a" />
          </linearGradient>
        </defs>
      </svg>
      <span className="font-mono text-lg font-semibold">{score.toFixed(1)}</span>
    </div>
  );
}

export function LookPreview() {
  const total = ITEMS.reduce((sum, i) => sum + i.price, 0);
  return (
    <article className="glass rounded-3xl p-5" aria-label="Sample look">
      <div className="flex items-center gap-4">
        <ScoreRing score={SCORE} />
        <div>
          <p className="text-[11px] font-medium tracking-[0.2em] text-brass uppercase">Fit Check</p>
          <p className="mt-1 text-sm leading-snug text-ivory/85">
            Warm olive print lifts your skin tone; relaxed collar keeps it effortless for a rooftop bar.
          </p>
        </div>
      </div>

      <ul className="mt-5 divide-y divide-border">
        {ITEMS.map((item) => (
          <li key={item.slot} className="flex items-baseline justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">{item.slot}</p>
              <p className="truncate text-sm">{item.name}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-mono text-sm">{item.price ? `S$${item.price.toFixed(2)}` : "Free"}</p>
              <p className="text-[11px] text-muted-foreground">{item.store}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-2 flex items-baseline justify-between border-t border-border pt-4">
        <span className="text-sm text-muted-foreground">Total, 1 store</span>
        <span className="font-mono text-xl font-semibold text-brass-bright">S${total.toFixed(2)}</span>
      </div>
    </article>
  );
}
