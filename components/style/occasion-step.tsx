"use client";

import Image from "next/image";
import { useId } from "react";
import type { Occasion, Tier } from "@/lib/catalog/types";
import { TIERS } from "@/lib/catalog/types";
import { OCCASION_CHOICES, TIER_LABELS } from "@/lib/occasions";
import { cn } from "@/lib/utils";
import { FlowShell, RAW_IMG_PROPS } from "./flow-shell";
import type { Photo } from "./style-flow";

export function OccasionStep(props: {
  photo: Photo | null;
  occasionId: Occasion;
  sentence: string;
  tier: Tier;
  onOccasion: (id: Occasion) => void;
  onSentence: (s: string) => void;
  onTier: (t: Tier) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const textId = useId();
  const ready = props.sentence.trim().length >= 3;

  return (
    <FlowShell step="Photo, then occasion">
      <div className="mt-4 flex items-center justify-between gap-4">
        <h1 className="text-head">The occasion</h1>
        {props.photo && (
          <button
            type="button"
            onClick={props.onBack}
            className="relative size-14 shrink-0 overflow-hidden bg-surface"
            aria-label="Change your photo"
          >
            <Image src={props.photo.url} alt="" fill sizes="56px" className="object-cover" {...RAW_IMG_PROPS} />
          </button>
        )}
      </div>

      <form
        className="mt-8 flex flex-col gap-8"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) props.onSubmit();
        }}
      >
        <fieldset>
          <legend className="font-medium">Where are you headed?</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {OCCASION_CHOICES.map((o) => {
              const on = props.occasionId === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => props.onOccasion(o.id)}
                  className={cn(
                    "min-h-11 px-4 transition-colors",
                    on ? "bg-brass text-background" : "bg-surface text-ivory hover:bg-surface-raised",
                  )}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div>
          <label htmlFor={textId} className="font-medium">
            Tell Wingman about it
          </label>
          <textarea
            id={textId}
            value={props.sentence}
            onChange={(e) => props.onSentence(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder="Where, when, and anything you want or want to avoid"
            className="mt-3 block w-full resize-none bg-surface p-4 text-lead leading-snug placeholder:text-muted-foreground focus:bg-surface-raised focus:outline-2 focus:outline-brass"
          />
        </div>

        <fieldset>
          <legend className="font-medium">Budget</legend>
          <div role="radiogroup" aria-label="Budget" className="mt-3 grid grid-cols-3 gap-1 bg-surface p-1">
            {TIERS.map((t) => {
              const on = props.tier === t;
              return (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => props.onTier(t)}
                  className={cn("min-h-11 transition-colors", on ? "bg-ivory text-background" : "text-ivory hover:bg-surface-raised")}
                >
                  {TIER_LABELS[t]}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-small text-muted-foreground">Relative to what Singapore stores charge for each piece.</p>
        </fieldset>

        <div className="flex flex-col gap-2">
          <button type="submit" disabled={!ready} className="btn w-full disabled:opacity-50">
            Style me
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
              <path d="M5 12h14m-6-6 6 6-6 6" />
            </svg>
          </button>
          <button type="button" onClick={props.onBack} className="text-link min-h-11 text-muted-foreground">
            Back to your photo
          </button>
        </div>
      </form>
    </FlowShell>
  );
}
