"use client";

import Image from "next/image";
import { useId, useState } from "react";
import { FlowShell, RAW_IMG_PROPS } from "@/components/style/flow-shell";
import type { Photo } from "@/components/style/style-flow";
import { downscalePhoto } from "@/lib/photo/downscale";

export function PhotoStep({
  photo,
  onPhoto,
  onNext,
  notice,
}: {
  photo: Photo | null;
  onPhoto: (photo: Photo) => void;
  onNext: () => void;
  /** Shown after "Delete my photo". */
  notice?: string | null;
}) {
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function choose(file: File | undefined) {
    if (!file) return;
    setProblem(null);
    if (!file.type.startsWith("image/")) return setProblem("That file isn't a photo. Choose a JPEG or PNG.");
    setBusy(true);
    try {
      const blob = await downscalePhoto(file);
      onPhoto({ blob, url: URL.createObjectURL(blob) });
    } catch {
      setProblem("We couldn't read that photo. Try another one.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <FlowShell step="Photo, then occasion">
      <h1 className="mt-4 text-head">Your photo</h1>
      {notice && (
        <p role="status" className="mt-4 bg-surface p-3">
          {notice}
        </p>
      )}
      <p className="mt-4 max-w-[36ch]">
        One photo, waist up, facing the camera in good light. Glasses are fine. Wingman tries the shirt or jacket on you;
        trousers, shoes and watches come as picks beside it.
      </p>

      <label
        htmlFor={inputId}
        className="relative mt-8 block aspect-[4/5] w-full cursor-pointer overflow-hidden bg-surface transition-colors hover:bg-surface-raised focus-within:outline-2 focus-within:outline-offset-3 focus-within:outline-brass"
      >
        {photo ? (
          <Image src={photo.url} alt="Your photo" fill sizes="(min-width: 640px) 36rem, 100vw" className="object-cover" {...RAW_IMG_PROPS} />
        ) : (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center">
            <svg viewBox="0 0 24 24" className="size-8 text-brass" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span className="text-lead">{busy ? "Reading your photo…" : "Take or choose a photo"}</span>
          </span>
        )}
        <input
          id={inputId}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            void choose(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
      {problem && (
        <p role="alert" className="mt-3 text-danger">
          {problem}
        </p>
      )}

      {photo && (
        <div className="mt-6 flex flex-col gap-2">
          <button type="button" onClick={onNext} className="btn w-full">
            Use this photo
          </button>
          <label htmlFor={inputId} className="text-link flex min-h-11 cursor-pointer items-center justify-center text-muted-foreground">
            Choose a different photo
          </label>
        </div>
      )}
      <p className="mt-6 text-small text-muted-foreground">Only used to style you. Try-ons are deleted after 24 hours.</p>
    </FlowShell>
  );
}
