import "server-only";

import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { AgentError } from "@/lib/agent/errors";
import { YouCamError, friendlyMessage } from "@/lib/youcam/errors";

type ErrorEvent = { type: "error"; code: string; message: string };

/**
 * Run `work` and stream what it emits as newline-delimited JSON. A thrown error becomes
 * a final "error" event: agent and YouCam errors keep their code, anything else is UNKNOWN.
 */
export function eventStream<E>(label: string, work: (send: (event: E | ErrorEvent) => void) => Promise<unknown>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: E | ErrorEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        await work(send);
      } catch (err) {
        if (err instanceof AgentError) {
          send({ type: "error", code: err.code, message: err.message });
        } else if (err instanceof YouCamError) {
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
async function photoFrom(form: FormData): Promise<{ bytes: Buffer } | { error: string; status: number }> {
  const photo = form.get("photo");
  if (!(photo instanceof File) || !photo.type.startsWith("image/")) return { error: "Add a photo.", status: 400 };
  if (photo.size > MAX_PHOTO_BYTES) return { error: "That photo is too large. Use one under 10 MB.", status: 413 };
  return { bytes: Buffer.from(await photo.arrayBuffer()) };
}

/** A JSON-encoded form field, or null if it's missing or not JSON. */
export function jsonField(name: string) {
  return (form: FormData): unknown => {
    try {
      return JSON.parse(String(form.get(name) ?? ""));
    } catch {
      return null;
    }
  };
}

/**
 * POST handler for the streamed agent routes. The body is a multipart form with the photo and
 * the fields `read` picks out, checked against `schema`. Bad input gets a JSON error with
 * `invalid` as the message; otherwise the response streams what `run` emits.
 */
export function photoStreamRoute<T, E>(opts: {
  label: string;
  read: (form: FormData) => unknown;
  schema: ZodType<T>;
  invalid: string;
  run: (photo: Buffer, fields: T, send: (event: E | ErrorEvent) => void) => Promise<unknown>;
}) {
  return async (request: Request): Promise<Response> => {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json({ error: "Send the photo and details as a multipart form." }, { status: 400 });
    }
    const photo = await photoFrom(form);
    if ("error" in photo) return NextResponse.json({ error: photo.error }, { status: photo.status });

    const fields = opts.schema.safeParse(opts.read(form));
    if (!fields.success) {
      return NextResponse.json({ error: opts.invalid, issues: fields.error.issues }, { status: 400 });
    }
    return eventStream<E>(opts.label, (send) => opts.run(photo.bytes, fields.data, send));
  };
}
