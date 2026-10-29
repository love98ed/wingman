import { IN_STOCK_PIECES, STORES } from "./looks-data";

/** The catalog behind every look: the stores by name and what is in stock, set large. */
export function Stores() {
  return (
    <section
      id="stores"
      aria-labelledby="stores-heading"
      className="relative z-10 grid gap-12 bg-surface px-(--margin) py-28 md:grid-cols-12 md:gap-6 md:py-40"
    >
      <div className="md:col-span-5">
        <h2 id="stores-heading" data-reveal className="text-head">
          The stores
        </h2>
        <dl className="mt-10 flex flex-col gap-8">
          {[
            [String(STORES.length), "independent Singapore stores"],
            [IN_STOCK_PIECES.toLocaleString("en-SG"), "pieces in stock to wear tonight"],
            ["One tap", "to each store's own checkout, sizes filled in"],
          ].map(([figure, label], i) => (
            <div key={label} data-reveal style={{ "--d": `${80 + i * 80}ms` } as React.CSSProperties}>
              <dt className="font-display text-head leading-none tabular-nums">{figure}</dt>
              <dd className="mt-2 text-lead">{label}</dd>
            </div>
          ))}
        </dl>
      </div>

      <ul aria-label="The stores" className="columns-2 gap-6 md:col-span-6 md:col-start-7 md:self-center">
        {STORES.map((store, i) => (
          <li
            key={store}
            data-reveal
            style={{ "--d": `${120 + i * 30}ms` } as React.CSSProperties}
            className="break-inside-avoid py-2 text-lead"
          >
            {store}
          </li>
        ))}
      </ul>
    </section>
  );
}
