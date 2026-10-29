"use client";

import Image from "next/image";
import { FlowShell, RAW_IMG_PROPS } from "@/components/style/flow-shell";
import type { Photo, Progress } from "@/components/style/style-flow";
import { STYLE_STEPS, type Look, type RenderKind, type StyleStep } from "@/lib/agent/events";
import { expectedKinds, imageStatus } from "@/lib/agent/images";
import { cn } from "@/lib/utils/cn";

const LABELS: Record<StyleStep, string> = {
  reading: "Reading your photo and what you asked for",
  picking: "Picking pieces from real Singapore stores",
  rendering: "Trying the looks on you",
  scoring: "Scoring each look",
};

const KIND_NAMES: Record<RenderKind, string> = { outfit: "Outfit", hair: "Hair", beard: "Beard" };

export function LoadingStep({
  photo,
  progress,
  refining,
  looks,
  settled,
  retrying,
  onRetry,
  onContinue,
}: {
  photo: Photo | null;
  progress: Progress;
  /** The chat request being applied, when this is a refine rather than the first run. */
  refining?: string | null;
  /** The looks being rendered, once they're picked; each expected image gets a tile. */
  looks: Look[];
  /** Rendering and scoring are over; anything still missing has failed. */
  settled: boolean;
  /** Failed images are being tried again. */
  retrying: boolean;
  onRetry: () => void;
  onContinue: () => void;
}) {
  const current = STYLE_STEPS.indexOf(progress.step);
  const status = imageStatus(looks);
  // Only offer the choice once nothing is still on its way
  const stuck = settled && !retrying && status.failed.length > 0;

  return (
    <FlowShell step={refining ? "Refining" : "Styling"}>
      <h1 className="mt-4 text-head">
        {stuck ? "Almost ready" : retrying ? "Trying again" : refining ? "New looks coming" : "Styling you"}
      </h1>
      <p className="mt-4">
        {stuck
          ? status.outOfUnits
            ? "Try-ons are paused for now, so some looks have no picture of you. Their pieces and prices are all there."
            : `${status.failed.length === 1 ? "One try-on" : `${status.failed.length} try-ons`} didn't work. Try again, or see your looks without ${status.failed.length === 1 ? "it" : "them"}.`
          : retrying
            ? "Redoing the try-ons that didn't work. The ones that did are kept."
            : `${refining ? `Re-picking every look for “${refining}”.` : "This takes about a minute."} Your looks open when every try-on is ready.`}
      </p>

      {stuck && (
        <div className="mt-6 flex flex-col gap-2">
          {!status.outOfUnits && (
            <button type="button" onClick={onRetry} className="btn w-full">
              Try again
            </button>
          )}
          <button
            type="button"
            onClick={onContinue}
            className={cn(status.outOfUnits ? "btn w-full" : "text-link flex min-h-11 items-center justify-center")}
          >
            See my looks
          </button>
        </div>
      )}

      {status.total > 0 ? (
        <section aria-labelledby="images-heading" className="mt-8">
          <h2 id="images-heading" className="subhead" aria-live="polite">
            <span className="tabular-nums">
              {status.ready} of {status.total}
            </span>{" "}
            ready
          </h2>
          <ul className="mt-4 grid grid-cols-3 gap-1">
            {looks.flatMap((look, i) =>
              expectedKinds(look).map((kind) => {
                const url = look.renders[kind];
                const failed = !url && look.renders.failed?.[kind];
                const label = `${KIND_NAMES[kind]}, ${look.name}`;
                return (
                  <li key={`${i}-${kind}`} className="min-w-0">
                    <div className="relative aspect-[4/5] overflow-hidden bg-surface">
                      {url ? (
                        <Image src={url} alt={label} fill sizes="(min-width: 640px) 12rem, 33vw" className="animate-in object-cover fade-in duration-500" {...RAW_IMG_PROPS} />
                      ) : failed ? (
                        <p className="absolute inset-0 flex items-end bg-surface-raised p-2 text-small">Didn&apos;t work</p>
                      ) : (
                        <div aria-hidden className="absolute inset-x-0 h-1/3 animate-scan bg-brass/20" />
                      )}
                    </div>
                    <p className="mt-1.5 truncate text-small text-muted-foreground">
                      {KIND_NAMES[kind]}
                      <span className="sr-only">
                        , {look.name}: {url ? "ready" : failed ? "didn't work" : "on its way"}
                      </span>
                    </p>
                  </li>
                );
              }),
            )}
          </ul>
        </section>
      ) : (
        <div className="mt-8 grid grid-cols-[7rem_1fr] gap-5 sm:grid-cols-[10rem_1fr]">
          <div className="relative aspect-[4/5] overflow-hidden bg-surface">
            {photo && <Image src={photo.url} alt="Your photo" fill sizes="10rem" className="object-cover" {...RAW_IMG_PROPS} />}
            <div aria-hidden className="absolute inset-x-0 h-1/3 animate-scan bg-brass/25" />
          </div>
          <Steps current={current} detail={progress.detail} />
        </div>
      )}

      {status.total > 0 && !stuck && (
        <div className="mt-8">
          <Steps current={current} detail={progress.detail} />
        </div>
      )}

      {!stuck && (
        <section aria-labelledby="wait-heading" className="mt-10 bg-surface p-5">
          <h2 id="wait-heading" className="subhead">
            While you wait
          </h2>
          <p className="mt-2">
            Wingman is picking in-stock pieces from independent Singapore stores and trying each look on your photo. When
            they open, you can swap any piece, see it cheaper, compare the look at three budgets and check out at each
            store.
          </p>
        </section>
      )}
    </FlowShell>
  );
}

function Steps({ current, detail }: { current: number; detail?: string }) {
  return (
    <ol className="flex flex-col justify-center gap-4" aria-live="polite">
      {STYLE_STEPS.map((step, i) => {
        const state = i < current ? "done" : i === current ? "active" : "pending";
        return (
          <li key={step} className={cn("flex gap-3", state === "pending" && "text-muted-foreground")}>
            <span
              aria-hidden
              className={cn(
                "mt-[0.45em] size-2.5 shrink-0",
                state === "done" && "bg-brass",
                state === "active" && "animate-pulse bg-ivory",
                state === "pending" && "bg-surface-raised",
              )}
            />
            <span>
              {LABELS[step]}
              {state === "active" && detail && <span className="block text-small text-muted-foreground">{detail}</span>}
              <span className="sr-only">{state === "done" ? " (done)" : state === "active" ? " (in progress)" : ""}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
