import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

// Route plumbing only: no Supabase, and `after` needs a request scope that tests don't have.
vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/server")>()), after: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: () => ({}) }));
vi.mock("@/lib/privacy", () => ({ deleteExpired: vi.fn(async () => 0) }));

const { AgentError } = await import("@/lib/agent/errors");
const { eventStream, jsonField, photoStreamRoute } = await import("@/lib/api/stream");
const { YouCamError, friendlyMessage } = await import("@/lib/youcam/errors");

/** Every newline-delimited JSON event in a response body. */
async function events(res: Response) {
  const text = await res.text();
  return text.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

const jpeg = (bytes = 10) => new File([new Uint8Array(bytes)], "photo.jpg", { type: "image/jpeg" });
const post = (form: FormData) => new Request("http://x/api/test", { method: "POST", body: form });

describe("eventStream", () => {
  it("streams each event as one JSON line", async () => {
    const res = eventStream<{ type: string; n: number }>("t", async (send) => {
      send({ type: "a", n: 1 });
      send({ type: "b", n: 2 });
    });
    expect(res.headers.get("Content-Type")).toContain("application/x-ndjson");
    expect(await events(res)).toEqual([
      { type: "a", n: 1 },
      { type: "b", n: 2 },
    ]);
  });

  it("ends with an error event that keeps agent and YouCam codes and hides anything else", async () => {
    const agent = await events(eventStream("t", async () => Promise.reject(new AgentError("NO_LOOKS", "Nothing fits."))));
    expect(agent).toEqual([{ type: "error", code: "NO_LOOKS", message: "Nothing fits." }]);

    const youcam = await events(eventStream("t", async () => Promise.reject(new YouCamError("QUOTA", "internal detail"))));
    expect(youcam).toEqual([{ type: "error", code: "QUOTA", message: friendlyMessage("QUOTA") }]);

    vi.spyOn(console, "error").mockImplementation(() => {});
    const other = await events(eventStream("t", async () => Promise.reject(new Error("secret stack detail"))));
    expect(other[0].code).toBe("UNKNOWN");
    expect(JSON.stringify(other)).not.toContain("secret");
  });

  it("keeps working quietly after the visitor disconnects", async () => {
    let finished = false;
    const res = eventStream<{ type: string }>("t", async (send) => {
      send({ type: "first" });
      await new Promise((r) => setTimeout(r, 10));
      send({ type: "after-disconnect" });
      finished = true;
    });
    await res.body!.cancel();
    await new Promise((r) => setTimeout(r, 30));
    expect(finished).toBe(true);
  });
});

describe("jsonField", () => {
  it("parses a JSON form field, or gives null for missing or broken JSON", () => {
    const form = new FormData();
    form.set("look", '{"name":"x"}');
    form.set("bad", "{not json");
    expect(jsonField("look")(form)).toEqual({ name: "x" });
    expect(jsonField("bad")(form)).toBeNull();
    expect(jsonField("missing")(form)).toBeNull();
  });
});

describe("photoStreamRoute", () => {
  const run = vi.fn(async (photo: Buffer, fields: { n: number }, send: (e: { type: string; n: number }) => void) => {
    send({ type: "got", n: fields.n });
  });
  const route = photoStreamRoute({
    label: "test",
    read: jsonField("body"),
    schema: z.object({ n: z.number() }),
    invalid: "Send a number.",
    run,
  });

  it("rejects a body that isn't a form", async () => {
    const res = await route(new Request("http://x", { method: "POST", body: "plain", headers: { "Content-Type": "text/plain" } }));
    expect(res.status).toBe(400);
  });

  it("needs an image file under 10 MB", async () => {
    const none = new FormData();
    none.set("body", '{"n":1}');
    expect((await route(post(none))).status).toBe(400);

    const text = new FormData();
    text.set("photo", new File(["hi"], "a.txt", { type: "text/plain" }));
    text.set("body", '{"n":1}');
    expect((await route(post(text))).status).toBe(400);

    const big = new FormData();
    big.set("photo", jpeg(10 * 1024 * 1024 + 1));
    big.set("body", '{"n":1}');
    expect((await route(post(big))).status).toBe(413);
  });

  it("returns the route's own message for invalid fields, without running the work", async () => {
    const form = new FormData();
    form.set("photo", jpeg());
    form.set("body", '{"n":"one"}');
    const res = await route(post(form));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Send a number.");
    expect(run).not.toHaveBeenCalled();
  });

  it("streams the work's events for a valid request", async () => {
    const form = new FormData();
    form.set("photo", jpeg(4));
    form.set("body", '{"n":7}');
    const res = await route(post(form));
    expect(res.status).toBe(200);
    expect(await events(res)).toEqual([{ type: "got", n: 7 }]);
    expect(run.mock.calls[0][0]).toHaveLength(4);
  });
});
