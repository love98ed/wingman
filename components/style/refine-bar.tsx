"use client";

import { useState } from "react";

const SUGGESTIONS = ["More casual", "Dressier", "Under S$500", "No white sneakers"];

/** Chat bar under the looks: one request re-picks all of them. */
export function RefineBar({ onRefine }: { onRefine: (message: string) => void }) {
  const [message, setMessage] = useState("");
  const send = (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length >= 2) onRefine(trimmed);
  };

  return (
    <div className="sticky bottom-0 -mx-(--margin) mt-10 bg-background px-(--margin) pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
      <div className="mx-auto max-w-xl">
        <div className="no-scrollbar -mx-(--margin) flex gap-2 overflow-x-auto px-(--margin)">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              className="min-h-11 shrink-0 bg-surface-raised px-4 text-small transition-colors hover:bg-surface active:scale-[0.97]"
            >
              {s}
            </button>
          ))}
        </div>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(message);
          }}
        >
          <label htmlFor="refine" className="sr-only">
            Tell Wingman what to change
          </label>
          <input
            id="refine"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={200}
            placeholder="Tell Wingman what to change"
            className="min-h-12 min-w-0 flex-1 bg-surface px-4 text-base placeholder:text-muted-foreground focus:bg-surface-raised focus:outline-2 focus:outline-brass"
          />
          <button type="submit" disabled={message.trim().length < 2} className="btn shrink-0 disabled:opacity-50">
            Refine
          </button>
        </form>
      </div>
    </div>
  );
}
