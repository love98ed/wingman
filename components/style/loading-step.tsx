"use client";

import Image from "next/image";
import { STYLE_STEPS, type StyleStep } from "@/lib/agent/events";
import { cn } from "@/lib/utils";
import { FlowShell, RAW_IMG_PROPS } from "./flow-shell";
import type { Photo, Progress } from "./style-flow";

const LABELS: Record<StyleStep, string> = {
  reading: "Reading your photo and what you asked for",
  picking: "Picking pieces from real Singapore stores",
  rendering: "Trying the looks on you",
  scoring: "Scoring each look",
};

export function LoadingStep({
  photo,
  progress,
  refining,
}: {
  photo: Photo | null;
  progress: Progress;
  /** The chat request being applied, when this is a refine rather than the first run. */
  refining?: string | null;
}) {
  const current = STYLE_STEPS.indexOf(progress.step);
  return (
    <FlowShell step={refining ? "Refining" : "Styling"}>
      <h1 className="mt-4 text-head">{refining ? "New looks coming" : "Styling you"}</h1>
      <p className="mt-4">
        {refining ? `Re-picking every look for “${refining}”.` : "This takes about half a minute."} The first look appears
        as soon as it&apos;s ready.
      </p>

      <div className="mt-8 grid grid-cols-[7rem_1fr] gap-5 sm:grid-cols-[10rem_1fr]">
        <div className="relative aspect-[4/5] overflow-hidden bg-surface">
          {photo && <Image src={photo.url} alt="Your photo" fill sizes="10rem" className="object-cover" {...RAW_IMG_PROPS} />}
          <div aria-hidden className="absolute inset-x-0 h-1/3 animate-scan bg-brass/25" />
        </div>

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
                  {state === "active" && progress.detail && (
                    <span className="block text-small text-muted-foreground">{progress.detail}</span>
                  )}
                  <span className="sr-only">{state === "done" ? " (done)" : state === "active" ? " (in progress)" : ""}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </FlowShell>
  );
}
