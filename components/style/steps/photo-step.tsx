"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useRef, useState } from "react";
import { FlowShell, RAW_IMG_PROPS } from "@/components/style/flow-shell";
import type { Photo } from "@/components/style/style-flow";
import { downscalePhoto } from "@/lib/photo/downscale";
import type { PhotoCheck } from "@/lib/photo/problems";

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

  const [checking, setChecking] = useState(false);
  /** The latest photo chosen, so a slow check of an earlier one is dropped. */
  const latest = useRef<string | null>(null);

  async function choose(file: File | undefined) {
    if (!file) return;
    setProblem(null);
    if (!file.type.startsWith("image/")) return setProblem("That file isn't a photo. Choose a JPEG or PNG.");
    setBusy(true);
    let blob: Blob;
    try {
      blob = await downscalePhoto(file);
    } catch {
      setBusy(false);
      return setProblem("We couldn't read that photo. Try another one.");
    }
    const url = URL.createObjectURL(blob);
    latest.current = url;
    onPhoto({ blob, url });
    setBusy(false);
    setChecking(true);
    const result = await check(blob);
    if (latest.current !== url) return;
    onPhoto({ blob, url, check: result });
    setChecking(false);
  }

  const hard = photo?.check?.problems.find((p) => !p.soft);
  const soft = photo?.check?.problems.filter((p) => p.soft) ?? [];
  const shown = hard ? [hard] : soft;

  return (
    <FlowShell step="Photo, then occasion">
      <h1 className="mt-4 text-head">Your photo</h1>
      {notice && (
        <p role="status" className="mt-4 bg-surface p-3">
          {notice}
        </p>
      )}
      <div className="mt-4 flex items-start justify-between gap-4">
        <p className="max-w-[36ch]">
          One photo, waist up, facing the camera in good light. Glasses are fine. Wingman tries the shirt or jacket on
          you; trousers, shoes and watches come as picks beside it.
        </p>
        {/* The framing that works, shown rather than described */}
        <figure className="w-16 shrink-0 sm:w-20">
          <div className="relative aspect-[4/5] overflow-hidden bg-surface">
            <Image src="/home/before.jpg" alt="Example: waist up, facing the camera" fill sizes="80px" className="object-cover object-[50%_25%]" />
          </div>
          <figcaption className="mt-1.5 text-small text-muted-foreground">Like this</figcaption>
        </figure>
      </div>

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

      {photo && checking && (
        <p role="status" className="mt-6">
          Checking your photo works for a try-on…
        </p>
      )}
      {photo && !checking && shown.length > 0 && (
        <div role="alert" className="mt-6 bg-surface p-4">
          {shown.map((p) => (
            <div key={p.code} className="not-first:mt-4">
              <p className="text-lead">{p.message}</p>
              <p className="mt-1">{p.tip}</p>
            </div>
          ))}
          {!hard && <p className="mt-4 text-muted-foreground">It may still work, so you can use it anyway.</p>}
        </div>
      )}

      {photo && !checking && (
        <div className="mt-6 flex flex-col gap-2">
          {shown.length > 0 ? (
            <label htmlFor={inputId} className="btn w-full cursor-pointer">
              Choose a different photo
            </label>
          ) : (
            <button type="button" onClick={onNext} className="btn w-full">
              Use this photo
            </button>
          )}
          {shown.length > 0 && !hard && (
            <button type="button" onClick={onNext} className="text-link flex min-h-11 items-center justify-center">
              Use it anyway
            </button>
          )}
          {shown.length === 0 && (
            <label htmlFor={inputId} className="text-link flex min-h-11 cursor-pointer items-center justify-center text-muted-foreground">
              Choose a different photo
            </label>
          )}
        </div>
      )}
      <section aria-labelledby="photo-tips" className="mt-10">
        <h2 id="photo-tips" className="font-sans text-lead font-medium tracking-normal normal-case">
          What works best
        </h2>
        <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 marker:text-muted-foreground">
          <li>Stand facing a window or a lamp, so your face is evenly lit.</li>
          <li>Waist up, with your head, shoulders and chest in the frame.</li>
          <li>Just you, looking straight at the camera.</li>
          <li>Glasses are fine. Hats, masks and hands over your face get in the way.</li>
        </ul>
      </section>
      <p className="mt-8 text-small text-muted-foreground">Only used to style you. Try-ons are deleted after 24 hours.</p>
      <Link href="/" className="text-link mt-4 inline-flex min-h-11 items-center text-muted-foreground">
        Back to the home page
      </Link>
    </FlowShell>
  );
}

/** Ask the server whether the photo will work. A check that can't run never blocks the user. */
async function check(blob: Blob): Promise<PhotoCheck | undefined> {
  const form = new FormData();
  form.set("photo", blob, "photo.jpg");
  try {
    const res = await fetch("/api/photo/check", { method: "POST", body: form });
    return res.ok ? ((await res.json()) as PhotoCheck) : undefined;
  } catch {
    return undefined;
  }
}
