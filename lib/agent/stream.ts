import "server-only";

import { YouCamError, friendlyMessage } from "@/lib/youcam/errors";

type ErrorEvent = { type: "error"; code: string; message: string };

/**
 * Run `work` and stream what it emits as newline-delimited JSON. A thrown error becomes
 * a final "error" event: typed YouCam errors keep their code, anything else is UNKNOWN.
 */
export function eventStream<E>(label: string, work: (send: (event: E | ErrorEvent) => void) => Promise<unknown>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: E | ErrorEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        await work(send);
      } catch (err) {
        if (err instanceof YouCamError) {
          send({ type: "error", code: err.code, message: friendlyMessage(err.code) });
        } else {
          console.error(`[${label}]`, err);
          send({ type: "error", code: "UNKNOWN", message: "Something went wrong while styling. Please try again." });
        }
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

/** The `photo` field of a multipart form as bytes, or a user-facing reason it can't be used. */
export async function photoFrom(form: FormData): Promise<{ bytes: Buffer } | { error: string; status: number }> {
  const photo = form.get("photo");
  if (!(photo instanceof File) || !photo.type.startsWith("image/")) return { error: "Add a photo.", status: 400 };
  if (photo.size > MAX_PHOTO_BYTES) return { error: "That photo is too large. Use one under 10 MB.", status: 413 };
  return { bytes: Buffer.from(await photo.arrayBuffer()) };
}
