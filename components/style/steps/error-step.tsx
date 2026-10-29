"use client";

import { FlowShell } from "@/components/style/flow-shell";

/** Photo problems need a new photo; everything else can simply be retried. */
const PHOTO_CODES = new Set(["NO_FACE", "BAD_LIGHTING"]);

export function ErrorStep({
  code,
  message,
  onRetry,
  onNewPhoto,
  onBack,
  onDeletePhoto,
}: {
  code: string;
  message: string;
  onRetry: () => void;
  onNewPhoto: () => void;
  onBack: () => void;
  onDeletePhoto: () => void;
}) {
  const photoProblem = PHOTO_CODES.has(code);
  return (
    <FlowShell step="Styling">
      <h1 className="mt-4 text-head">
        {photoProblem ? "Try another photo" : code === "NO_LOOKS" ? "No looks worth showing" : "That didn't work"}
      </h1>
      <p role="alert" className="mt-4 max-w-[38ch] text-lead">
        {message}
      </p>
      {photoProblem && (
        <p className="mt-4 max-w-[38ch] text-muted-foreground">
          Waist up, facing the camera, in even light. Glasses are fine.
        </p>
      )}
      <div className="mt-8 flex flex-col gap-2">
        {photoProblem ? (
          <button type="button" onClick={onNewPhoto} className="btn w-full">
            Choose another photo
          </button>
        ) : (
          <button type="button" onClick={onRetry} className="btn w-full">
            Try again
          </button>
        )}
        <button type="button" onClick={onBack} className="text-link min-h-11 text-muted-foreground">
          Change the occasion
        </button>
        <button type="button" onClick={onDeletePhoto} className="text-link min-h-11 text-muted-foreground">
          Delete my photo
        </button>
      </div>
    </FlowShell>
  );
}
