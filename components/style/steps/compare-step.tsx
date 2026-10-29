"use client";

import Image from "next/image";
import { FlowShell, RAW_IMG_PROPS } from "@/components/style/flow-shell";
import { ProductImage } from "@/components/style/product-image";
import type { Photo } from "@/components/style/style-flow";
import type { Look, TierVersion } from "@/lib/agent/events";
import { displayName } from "@/lib/catalog/names";
import { TIERS, type Tier } from "@/lib/catalog/types";
import { TIER_LABELS } from "@/lib/occasions";
import { cn } from "@/lib/utils/cn";
import { sgd } from "@/lib/utils/format";

export type CompareState = {
  /** The other tiers, filled in as /api/compare streams them. Keeps the look's old tier after a switch. */
  versions: Partial<Record<Tier, TierVersion>>;
  status: "loading" | "done" | "error";
  error?: string;
};


/** The look as it stands, shaped like a compare column. */
export const versionOf = (look: Look): TierVersion => ({
  tier: look.tier,
  items: look.items,
  total: look.total,
  note: "",
  why: look.why,
  renders: { outfit: look.renders.outfit, hair: look.renders.hair, errors: look.renders.errors },
  fitCheck: look.fitCheck,
});

/** The same look at Budget, Mid-range and Luxury, side by side, with the real SGD total under each. */
export function CompareStep({
  look,
  state,
  photo,
  onChoose,
  onBack,
  onRetry,
}: {
  look: Look;
  state: CompareState;
  photo: Photo | null;
  onChoose: (version: TierVersion) => void;
  onBack: () => void;
  onRetry: () => void;
}) {
  const columns = TIERS.map((tier) => (tier === look.tier ? versionOf(look) : state.versions[tier]));
  const notes = columns.filter((v): v is TierVersion => !!v?.note);

  return (
    <FlowShell step="Price compare" wide>
      <div className="max-w-xl">
        <h1 className="mt-4 text-head">One look, three budgets</h1>
        <p className="mt-3">
          {look.name}, rebuilt from each price tier with the same colours and cut. Totals are real prices in SGD.
        </p>
      </div>

      <div className="mt-8 grid max-w-3xl grid-cols-3 gap-2 sm:gap-4" aria-live="polite">
        {columns.map((version, i) => (
          <Column
            key={TIERS[i]}
            tier={TIERS[i]}
            version={version}
            current={TIERS[i] === look.tier}
            finished={state.status !== "loading"}
            photo={photo}
            onChoose={onChoose}
          />
        ))}
      </div>

      {state.status === "error" && (
        <div className="mt-6 max-w-xl">
          <p role="alert">{state.error}</p>
          <button type="button" onClick={onRetry} className="text-link mt-2 min-h-11">
            Try the comparison again
          </button>
        </div>
      )}

      {notes.length > 0 && (
        <div className="mt-10 max-w-xl">
          <h2 className="text-lead">What changes</h2>
          <dl className="mt-4 flex flex-col gap-4">
            {notes.map((v) => (
              <div key={v.tier}>
                <dt className="font-medium">{TIER_LABELS[v.tier]}</dt>
                <dd className="mt-1">{v.note}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div className="mt-10 max-w-xl">
        <button type="button" onClick={onBack} className="text-link min-h-11 text-muted-foreground">
          Back to your looks
        </button>
      </div>
    </FlowShell>
  );
}

function Column({
  tier,
  version,
  current,
  finished,
  photo,
  onChoose,
}: {
  tier: Tier;
  version?: TierVersion;
  current: boolean;
  finished: boolean;
  photo: Photo | null;
  onChoose: (version: TierVersion) => void;
}) {
  const render = version?.renders.outfit;
  const waiting = !render && !finished;

  return (
    <section aria-label={`${TIER_LABELS[tier]}${current ? ", your look" : ""}`} className={cn("flex min-w-0 flex-col", current ? "bg-surface-raised" : "bg-surface")}>
      <div className="relative aspect-[4/5] overflow-hidden bg-surface-raised">
        {render ? (
          <Image src={render} alt={`You in the ${TIER_LABELS[tier]} version`} fill sizes="(min-width: 640px) 16rem, 30vw" className="animate-in object-cover fade-in duration-500" {...RAW_IMG_PROPS} />
        ) : (
          photo && <Image src={photo.url} alt="" fill sizes="30vw" className="object-cover opacity-40" {...RAW_IMG_PROPS} />
        )}
        {waiting && <div aria-hidden className="absolute inset-x-0 h-1/3 animate-scan bg-brass/25" />}
        {version && !render && finished && (
          <p className="absolute inset-x-0 bottom-0 bg-background/80 p-2 text-small">
            {version.renders.errors.includes("QUOTA") ? "Try-ons paused" : "No try-on"}
          </p>
        )}
      </div>

      <div className="flex flex-1 flex-col p-2 sm:p-4">
        <p className="text-small font-medium">{TIER_LABELS[tier]}</p>
        {version ? (
          <>
            <p className="mt-1 text-lead tabular-nums">{sgd(version.total, { whole: true })}</p>
            <p className="mt-1 text-small tabular-nums text-muted-foreground">
              {version.fitCheck ? (
                <>
                  Fit check <span className="text-brass">{version.fitCheck.score.toFixed(1)}</span>
                </>
              ) : finished ? (
                "No score"
              ) : (
                "Scoring…"
              )}
            </p>

            <ul className="mt-3 flex flex-col gap-2">
              {version.items.map((item) => (
                <li key={item.id}>
                  <a href={item.url} target="_blank" rel="noopener" className="group block" title={displayName(item.name, item.storeName)}>
                    <ProductImage src={item.image} alt={displayName(item.name, item.storeName)} sizes="(min-width: 640px) 14rem, 28vw" className="aspect-square" />
                    <span className="mt-1 line-clamp-2 text-small group-hover:underline">{displayName(item.name, item.storeName)}</span>
                    <span className="block text-small tabular-nums text-muted-foreground">
                      {item.storeName} · {sgd(item.price, { whole: true })}
                    </span>
                  </a>
                </li>
              ))}
            </ul>

            {/* Pinned to the bottom so the three columns line up */}
            <div className="mt-auto pt-3">
              {current ? (
                <p className="flex min-h-11 items-center text-small text-muted-foreground">Your look</p>
              ) : (
                <button
                  type="button"
                  onClick={() => onChoose(version)}
                  className="min-h-11 w-full bg-surface-raised px-2 text-small font-medium transition-colors hover:bg-background active:scale-[0.97]"
                >
                  Wear this version
                </button>
              )}
            </div>
          </>
        ) : (
          <p className="mt-1 text-small text-muted-foreground">{finished ? "Not available" : "Finding pieces…"}</p>
        )}
      </div>
    </section>
  );
}
