"use client";

import { useEffect, useRef, useState } from "react";
import { BrowseStep, type BrowseFilters } from "@/components/style/steps/browse-step";
import { CartStep } from "@/components/style/steps/cart-step";
import { CompareStep, versionOf, type CompareState } from "@/components/style/steps/compare-step";
import { ErrorStep } from "@/components/style/steps/error-step";
import { LoadingStep } from "@/components/style/steps/loading-step";
import { LooksStep } from "@/components/style/steps/looks-step";
import { OccasionStep } from "@/components/style/steps/occasion-step";
import { PhotoStep } from "@/components/style/steps/photo-step";
import { PrepStep } from "@/components/style/steps/prep-step";
import { SwapStep, type SwapOptionsState } from "@/components/style/steps/swap-step";
import {
  readEvents,
  showsInRender,
  type CompareEvent,
  type Look,
  type LookItem,
  type StyleEvent,
  type StyleStep,
  type SwapEvent,
  type TierVersion,
} from "@/lib/agent/events";
import type { ParsedOccasion, PrepPlan } from "@/lib/agent/schemas";
import { imageStatus } from "@/lib/agent/images";
import { SLOTS } from "@/lib/agent/slots";
import { isOneSize, type CartLine } from "@/lib/cart";
import type { Occasion, Tier } from "@/lib/catalog/types";
import { OCCASION_CHOICES } from "@/lib/occasions";
import type { PhotoCheck } from "@/lib/photo/problems";

export type Photo = { blob: Blob; url: string; check?: PhotoCheck };
export type Progress = { step: StyleStep; detail?: string };
type Phase = "photo" | "occasion" | "loading" | "looks" | "compare" | "swap" | "cart" | "prep" | "browse" | "error";

/** What a back button says, by the screen it returns to. */
const BACK_LABELS: Record<Phase, string> = {
  photo: "Back to your photo",
  occasion: "Back to the occasion",
  loading: "Back",
  looks: "Back to your looks",
  compare: "Back to the comparison",
  swap: "Back to the options",
  cart: "Back to your cart",
  prep: "Back to the prep plan",
  browse: "Back to browsing",
  error: "Back",
};
type Slot = LookItem["slot"];

/** The ids of a look's pieces: swap alternatives are cached per look and slot. */
const signature = (look: Look) => look.items.map((i) => i.id).join(",");
const optionsKey = (look: Look, slot: LookItem["slot"], cheaper: boolean) => `${signature(look)}|${slot}${cheaper ? "|cheaper" : ""}`;
const roundTotal = (items: LookItem[]) => Math.round(items.reduce((sum, i) => sum + i.price, 0) * 100) / 100;

/** Read an error body from a failed JSON or stream request. */
const errorFrom = async (res: Response, fallback: string) =>
  ((await res.json().catch(() => ({}))) as { error?: string }).error ?? fallback;

/** What the flow keeps when the visitor leaves /style, so coming back picks up where they were. */
type Saved = {
  phase: Phase;
  photo: Photo | null;
  occasionId: Occasion;
  sentence: string;
  tier: Tier;
  looks: Look[];
  parsed: ParsedOccasion | null;
  compares: Record<number, CompareState>;
  swapOptions: Record<string, SwapOptionsState>;
  cart: CartLine[];
  prep: { plan: PrepPlan; skinAnalysed: boolean } | null;
  browseFilters: BrowseFilters;
  focusLook: number;
};

/**
 * Held in memory only, for moves within the site (to the home page and back). Nothing is
 * written to the browser's storage, so a refresh or a new tab starts over and the photo is
 * never kept anywhere but this page.
 */
let saved: Saved | null = null;

/** Where a visitor coming back lands: the screen they left, unless they picked an occasion on the way in. */
function arrival(initialOccasion: Occasion | undefined): Saved | null {
  if (!saved) return null;
  const choice = OCCASION_CHOICES.find((o) => o.id === initialOccasion);
  if (choice) {
    return { ...saved, occasionId: choice.id, sentence: choice.example, phase: saved.photo ? "occasion" : "photo" };
  }
  // Requests in flight were cancelled on the way out: drop what they'd started so it reloads
  const settledOnly = <T extends { status: string }>(map: Record<string, T>) =>
    Object.fromEntries(Object.entries(map).filter(([, v]) => v.status !== "loading"));
  const interrupted = ["loading", "error", "compare", "swap"].includes(saved.phase);
  const phase = interrupted ? (saved.looks.length ? "looks" : saved.photo ? "occasion" : "photo") : saved.phase;
  return { ...saved, phase, compares: settledOnly(saved.compares), swapOptions: settledOnly(saved.swapOptions) };
}

/** Photo, then occasion, then a streamed styling run that lands on the looks. */
export function StyleFlow({ initialOccasion }: { initialOccasion?: Occasion }) {
  const start = OCCASION_CHOICES.find((o) => o.id === initialOccasion) ?? OCCASION_CHOICES[0];
  const [returning] = useState(() => arrival(initialOccasion));
  const [phase, setPhase] = useState<Phase>(returning?.phase ?? "photo");
  /**
   * Screens visited, mirrored in the browser history so its back and forward buttons move
   * between screens too. `at` is the current entry. The loading screen is never kept: the
   * screen after it takes its place.
   */
  const trail = useRef<{ phases: Phase[]; at: number }>({ phases: [returning?.phase ?? "photo"], at: 0 });
  const previous = trail.current.at > 0 ? trail.current.phases[trail.current.at - 1] : null;
  const [photo, setPhoto] = useState<Photo | null>(returning?.photo ?? null);
  const [occasionId, setOccasionId] = useState<Occasion>(returning?.occasionId ?? start.id);
  const [sentence, setSentence] = useState(returning?.sentence ?? start.example);
  const [tier, setTier] = useState<Tier>(returning?.tier ?? "mid");
  const [progress, setProgress] = useState<Progress>({ step: "reading" });
  const [looks, setLooks] = useState<Look[]>(returning?.looks ?? []);
  const [parsed, setParsed] = useState<ParsedOccasion | null>(returning?.parsed ?? null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  /** The request being applied while the loading screen shows a refine. */
  const [refining, setRefining] = useState<string | null>(null);
  /** A refine, swap or delete that failed; the looks stay as they were. */
  const [notice, setNotice] = useState<string | null>(null);
  /** Confirms "Delete my photo" on the photo screen. */
  const [photoNotice, setPhotoNotice] = useState<string | null>(null);
  /** Price Compare per look index; kept so reopening a comparison is instant. */
  const [compares, setCompares] = useState<Record<number, CompareState>>(returning?.compares ?? {});
  const [comparing, setComparing] = useState(0);
  const [swapping, setSwapping] = useState<{ look: number; slot: Slot; cheaper: boolean }>({ look: 0, slot: "top", cheaper: false });
  const [swapOptions, setSwapOptions] = useState<Record<string, SwapOptionsState>>(returning?.swapOptions ?? {});
  /** Kept across refines and new runs, so pieces from earlier looks stay in the cart. */
  const [cart, setCart] = useState<CartLine[]>(returning?.cart ?? []);
  const [prep, setPrep] = useState<{ plan: PrepPlan; skinAnalysed: boolean } | null>(returning?.prep ?? null);
  const [browseFilters, setBrowseFilters] = useState<BrowseFilters>(returning?.browseFilters ?? { category: "top", sort: "featured" });
  /** The look card to bring into view when returning to the looks. */
  const [focusLook, setFocusLook] = useState(returning?.focusLook ?? 0);
  /** The run has finished rendering and scoring; the loading screen opens the looks once no image is missing. */
  const [settled, setSettled] = useState(false);
  /** Looks whose failed images are being tried again. */
  const [retrying, setRetrying] = useState(0);
  const abort = useRef<AbortController | null>(null);
  /** Compares and swaps in flight; a new run or refine cancels them. */
  const sideAborts = useRef<AbortController[]>([]);
  /** Latest swap per look, so a slower earlier swap can't overwrite a newer one. */
  const swapTokens = useRef<Record<number, number>>({});

  // Each step is its own screen: start it at the top
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [phase]);
  // Every image landed (or the user chose to go on without the missing ones): open the looks
  useEffect(() => {
    if (phase === "loading" && settled && retrying === 0 && imageStatus(looks).failed.length === 0) go("looks");
    // go only reads the trail ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, settled, retrying, looks]);
  useEffect(
    () => () => {
      abort.current?.abort();
      sideAborts.current.forEach((c) => c.abort());
    },
    [],
  );
  // Free a photo's image once another replaces it. Not on unmount: the saved flow still shows it.
  const shownUrl = useRef(photo?.url);
  useEffect(() => {
    if (shownUrl.current && shownUrl.current !== photo?.url) URL.revokeObjectURL(shownUrl.current);
    shownUrl.current = photo?.url;
  }, [photo?.url]);

  // Keep the flow for a visit to the home page and back
  useEffect(() => {
    saved = { phase, photo, occasionId, sentence, tier, looks, parsed, compares, swapOptions, cart, prep, browseFilters, focusLook };
  }, [phase, photo, occasionId, sentence, tier, looks, parsed, compares, swapOptions, cart, prep, browseFilters, focusLook]);

  const record = (next: Phase, replace: boolean) => {
    const t = trail.current;
    if (replace) t.phases[t.at] = next;
    else {
      t.phases = [...t.phases.slice(0, t.at + 1), next];
      t.at++;
    }
    window.history[replace ? "replaceState" : "pushState"]({ wingman: t.at }, "");
    setPhase(next);
  };

  /** Open a screen. Leaving the loading screen replaces it, or returns to the screen it came from. */
  const go = (next: Phase) => {
    const t = trail.current;
    if (t.phases[t.at] === next) return setPhase(next);
    if (t.phases[t.at] === "loading" && t.phases[t.at - 1] === next) return back();
    record(next, t.phases[t.at] === "loading");
  };

  /**
   * Back to the screen before this one (the browser's back does the same). The trail moves at
   * once, so a second call before the browser's popstate lands can't step back twice.
   */
  const back = () => {
    const t = trail.current;
    if (t.at === 0) return;
    t.at--;
    setPhase(t.phases[t.at]);
    window.history.back();
  };

  /** Finish a sub-screen: step back if it opened from `to`, otherwise open `to`. */
  const returnTo = (to: Phase) => (previous === to ? back() : go(to));

  /** Start over at `to` with nothing behind it in the flow, e.g. after deleting the photo. */
  const resetTo = (to: Phase) => {
    trail.current = { phases: [to], at: 0 };
    window.history.replaceState({ wingman: 0 }, "");
    setPhase(to);
  };

  // Browser back and forward move through the trail
  useEffect(() => {
    window.history.replaceState({ wingman: 0 }, "");
    const onPop = (event: PopStateEvent) => {
      const at = (event.state as { wingman?: number } | null)?.wingman;
      if (typeof at !== "number" || !trail.current.phases[at]) return;
      trail.current.at = at;
      setPhase(trail.current.phases[at]);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const sideController = () => {
    const controller = new AbortController();
    sideAborts.current.push(controller);
    return controller;
  };

  const lookRef = (look: Look) => ({
    name: look.name,
    tier: look.tier,
    items: look.items.map((i) => ({ slot: i.slot, id: i.id })),
    hair: look.hair,
    occasion: parsed,
  });

  /**
   * POST to /api/style or /api/refine and stream the looks in. The loading screen gives way to
   * the looks as soon as the first outfit render lands. `onFail` decides what a failure shows.
   */
  const streamLooks = async (endpoint: string, form: FormData, onFail: (code: string, message: string) => void) => {
    abort.current?.abort();
    sideAborts.current.forEach((c) => c.abort());
    sideAborts.current = [];
    const controller = new AbortController();
    abort.current = controller;
    setProgress({ step: "reading" });
    setNotice(null);
    setSettled(false);
    go("loading");

    try {
      const res = await fetch(endpoint, { method: "POST", body: form, signal: controller.signal });
      if (!res.ok || !res.body) {
        return onFail("UNKNOWN", await errorFrom(res, "Something went wrong while styling. Please try again."));
      }
      let failed = false;
      await readEvents<StyleEvent>(res.body, (event) => {
        switch (event.type) {
          case "progress":
            setProgress({ step: event.step, detail: event.detail });
            break;
          case "looks":
            setParsed(event.occasion);
            setLooks(event.looks);
            setCompares({});
            break;
          case "render":
            setLooks((prev) =>
              prev.map((look, i) => (i === event.look ? { ...look, renders: { ...look.renders, [event.kind]: event.url } } : look)),
            );
            break;
          case "renderFailed":
            setLooks((prev) =>
              prev.map((look, i) =>
                i === event.look
                  ? { ...look, renders: { ...look.renders, failed: { ...look.renders.failed, [event.kind]: event.code } } }
                  : look,
              ),
            );
            break;
          case "ready":
            setSettled(true);
            break;
          case "fitcheck":
            setLooks((prev) => prev.map((look, i) => ({ ...look, fitCheck: event.checks[i] ?? look.fitCheck })));
            break;
          case "refined":
            setNotice(event.reply);
            break;
          case "prune": {
            setLooks((prev) => event.keep.flatMap((i) => (prev[i] ? [prev[i]] : [])));
            const dropped = `Wingman left out ${event.dropped === 1 ? "a look" : `${event.dropped} looks`} that didn't score well enough to show you.`;
            setNotice((prev) => (prev ? `${prev} ${dropped}` : dropped));
            setCompares({});
            setFocusLook(0);
            break;
          }
          case "prep":
            setPrep({ plan: event.prepPlan, skinAnalysed: event.skinAnalysed });
            break;
          case "result":
            // The stream already carried every look; keep what this screen has since added (retried images)
            setLooks((prev) =>
              event.result.looks.map((look, i) => ({ ...look, renders: { ...look.renders, ...prev[i]?.renders } })),
            );
            setPrep({ plan: event.result.prepPlan, skinAnalysed: event.result.skinAnalysed });
            break;
          case "error":
            failed = true;
            onFail(event.code, event.message);
            break;
        }
      });
      // The looks open from the effect above once no image is missing
      if (!failed && !controller.signal.aborted) setSettled(true);
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error(err);
      onFail("UNKNOWN", "We lost the connection while styling. Please try again.");
    } finally {
      if (abort.current === controller) setRefining(null);
    }
  };

  const run = () => {
    if (!photo) return go("photo");
    setLooks([]);
    setParsed(null);
    setPrep(null);
    setCompares({});
    setSwapOptions({});
    setFocusLook(0);
    const form = new FormData();
    form.set("photo", photo.blob, "photo.jpg");
    form.set("occasion", sentence);
    form.set("tier", tier);
    void streamLooks("/api/style", form, (code, message) => {
      setError({ code, message });
      go("error");
    });
  };

  /** Re-pick every look with one chat request. A failure puts the old looks back. */
  const refine = (message: string) => {
    if (!photo || !parsed) return;
    const before = { looks, parsed };
    setRefining(message);
    const form = new FormData();
    form.set("photo", photo.blob, "photo.jpg");
    form.set(
      "refine",
      JSON.stringify({
        message,
        sentence,
        tier,
        occasion: parsed,
        previous: looks.map((l) => ({ name: l.name, items: l.items.map((i) => i.name), total: l.total })),
      }),
    );
    void streamLooks("/api/refine", form, (_code, text) => {
      setLooks(before.looks);
      setParsed(before.parsed);
      setCompares({});
      setNotice(text);
      returnTo("looks");
    });
  };

  const startCompare = async (index: number) => {
    const look = looks[index];
    if (!photo || !look || !parsed) return;
    const controller = sideController();
    const update = (fn: (state: CompareState) => CompareState) =>
      setCompares((prev) => ({ ...prev, [index]: fn(prev[index] ?? { versions: {}, status: "loading" }) }));
    const patch = (tier: TierVersion["tier"], fn: (v: TierVersion) => TierVersion) =>
      update((s) => (s.versions[tier] ? { ...s, versions: { ...s.versions, [tier]: fn(s.versions[tier]!) } } : s));
    setCompares((prev) => ({ ...prev, [index]: { versions: {}, status: "loading" } }));

    const form = new FormData();
    form.set("photo", photo.blob, "photo.jpg");
    form.set("look", JSON.stringify(lookRef(look)));
    try {
      const res = await fetch("/api/compare", { method: "POST", body: form, signal: controller.signal });
      if (!res.ok || !res.body) {
        const message = await errorFrom(res, "We couldn't compare prices for this look.");
        return update((s) => ({ ...s, status: "error", error: message }));
      }
      await readEvents<CompareEvent>(res.body, (event) => {
        switch (event.type) {
          case "versions":
            update((s) => ({ ...s, versions: { ...s.versions, ...Object.fromEntries(event.versions.map((v) => [v.tier, v])) } }));
            break;
          case "render":
            patch(event.tier, (v) => ({ ...v, renders: { ...v.renders, [event.kind]: event.url } }));
            break;
          case "fitcheck":
            patch(event.tier, (v) => ({ ...v, fitCheck: event.check }));
            break;
          case "done":
            update((s) => ({ ...s, status: "done" }));
            break;
          case "error":
            update((s) => ({ ...s, status: "error", error: event.message }));
            break;
        }
      });
      update((s) => (s.status === "loading" ? { ...s, status: "done" } : s));
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error(err);
      update((s) => ({ ...s, status: "error", error: "We lost the connection while comparing. Please try again." }));
    }
  };

  const openCompare = (index: number) => {
    setComparing(index);
    go("compare");
    if (!compares[index] || compares[index].status === "error") void startCompare(index);
  };

  /** Swap a look for its version at another tier; the old version stays in the comparison. */
  const chooseVersion = (version: TierVersion) => {
    const look = looks[comparing];
    setCompares((prev) => ({
      ...prev,
      [comparing]: { ...prev[comparing], versions: { ...prev[comparing].versions, [look.tier]: versionOf(look) } },
    }));
    setLooks((prev) =>
      prev.map((l, i) =>
        i === comparing
          ? {
              ...l,
              tier: version.tier,
              why: version.why ?? version.note,
              items: version.items,
              total: version.total,
              fitCheck: version.fitCheck,
              // Beard is on the face crop, so it carries over; outfit and hair belong to the version.
              renders: { ...l.renders, outfit: version.renders.outfit, hair: version.renders.hair, errors: version.renders.errors },
            }
          : l,
      ),
    );
    returnTo("looks");
  };

  const loadSwapOptions = async (look: Look, slot: Slot, cheaper: boolean) => {
    const key = optionsKey(look, slot, cheaper);
    const controller = sideController();
    setSwapOptions((prev) => ({ ...prev, [key]: { status: "loading", options: [] } }));
    try {
      const res = await fetch("/api/swap/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...lookRef(look), slot, cheaper }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(await errorFrom(res, "We couldn't load alternatives. Please try again."));
      const { options } = (await res.json()) as { options: LookItem[] };
      setSwapOptions((prev) => ({ ...prev, [key]: { status: "done", options } }));
    } catch (err) {
      if (controller.signal.aborted) return;
      setSwapOptions((prev) => ({ ...prev, [key]: { status: "error", options: [], error: (err as Error).message } }));
    }
  };

  /** Alternatives for one piece; `cheaper` shows only pieces that cost less. */
  const openSwap = (index: number, slot: Slot, cheaper = false) => {
    setSwapping({ look: index, slot, cheaper });
    go("swap");
    const state = swapOptions[optionsKey(looks[index], slot, cheaper)];
    if (!state || state.status === "error") void loadSwapOptions(looks[index], slot, cheaper);
  };

  /**
   * Put a piece into a look, replacing the one in its slot or adding the slot (a layer, a watch).
   * Items and total update at once, then the new try-on and Fit Check stream in. Only a change
   * to the garment on top clears the render while it re-renders.
   */
  const applyPiece = async (index: number, option: LookItem) => {
    const before = looks[index];
    if (!photo || !before) return;
    const slot = option.slot;
    const items = SLOTS.flatMap((s) => (s === slot ? [option] : before.items.filter((i) => i.slot === s)));
    const token = (swapTokens.current[index] ?? 0) + 1;
    swapTokens.current[index] = token;
    const current = () => swapTokens.current[index] === token;
    const patch = (fn: (look: Look) => Look) => {
      if (current()) setLooks((prev) => prev.map((l, i) => (i === index ? fn(l) : l)));
    };

    const swapped: Look = {
      ...before,
      items,
      total: roundTotal(items),
      fitCheck: null,
      renders: showsInRender({ ...before, items }, slot) ? { beard: before.renders.beard, errors: [] } : before.renders,
    };
    setLooks((prev) => prev.map((l, i) => (i === index ? swapped : l)));
    // The comparison was for the old pieces
    setCompares((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
    setNotice(null);
    setFocusLook(index);
    returnTo("looks");

    const controller = sideController();
    const form = new FormData();
    form.set("photo", photo.blob, "photo.jpg");
    form.set("look", JSON.stringify(lookRef(swapped)));
    const fail = (message: string) => {
      patch(() => before);
      if (current()) setNotice(message);
    };
    try {
      const res = await fetch("/api/swap", { method: "POST", body: form, signal: controller.signal });
      if (!res.ok || !res.body) return fail(await errorFrom(res, "That swap didn't work. Please try again."));
      await readEvents<SwapEvent>(res.body, (event) => {
        if (event.type === "render") patch((l) => ({ ...l, renders: { ...l.renders, [event.kind]: event.url } }));
        else if (event.type === "fitcheck") patch((l) => ({ ...l, fitCheck: event.check }));
        else if (event.type === "error") fail(event.message);
      });
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error(err);
      fail("We lost the connection while swapping. Please try again.");
    }
  };

  /**
   * Try the failed images again: the swap route re-renders the look as it is. Images that already
   * worked come from the render cache at no cost, so only the failed ones call YouCam again.
   */
  const retryImages = () => {
    if (!photo) return;
    const failedLooks = [...new Set(imageStatus(looks).failed.map((f) => f.look))];
    setRetrying(failedLooks.length);
    for (const index of failedLooks) {
      const look = looks[index];
      const patch = (fn: (look: Look) => Look) => setLooks((prev) => prev.map((l, i) => (i === index ? fn(l) : l)));
      patch((l) => ({ ...l, renders: { ...l.renders, failed: {} } }));
      const controller = sideController();
      const form = new FormData();
      form.set("photo", photo.blob, "photo.jpg");
      form.set("look", JSON.stringify({ ...lookRef(look), beard: look.renders.failed?.beard ? look.beard : null }));
      const failAll = (code: string) =>
        patch((l) => ({
          ...l,
          renders: { ...l.renders, failed: Object.fromEntries(Object.keys(look.renders.failed ?? {}).map((k) => [k, code])) },
        }));
      void (async () => {
        try {
          const res = await fetch("/api/swap", { method: "POST", body: form, signal: controller.signal });
          if (!res.ok || !res.body) return failAll("UNKNOWN");
          await readEvents<SwapEvent>(res.body, (event) => {
            if (event.type === "render") patch((l) => ({ ...l, renders: { ...l.renders, [event.kind]: event.url } }));
            else if (event.type === "renderFailed")
              patch((l) => ({ ...l, renders: { ...l.renders, failed: { ...l.renders.failed, [event.kind]: event.code } } }));
            else if (event.type === "fitcheck") patch((l) => ({ ...l, fitCheck: event.check }));
            else if (event.type === "error") failAll(event.code);
          });
        } catch (err) {
          if (!controller.signal.aborted) {
            console.error(err);
            failAll("UNKNOWN");
          }
        } finally {
          setRetrying((n) => Math.max(0, n - 1));
        }
      })();
    }
  };

  /** Go on to the looks without the images that failed; their cards show the pieces on their own. */
  const skipMissingImages = () => {
    setLooks((prev) =>
      prev.map((l) => ({
        ...l,
        renders: { ...l.renders, errors: [...l.renders.errors, ...Object.values(l.renders.failed ?? {})], failed: {} },
      })),
    );
    go("looks");
  };

  /** Pieces into the cart (once each); a one-size piece needs no size pick. */
  const addToCart = (pieces: LookItem[]) => {
    setCart((prev) => {
      const have = new Set(prev.map((l) => l.id));
      const added: CartLine[] = pieces
        .filter((item) => !have.has(item.id))
        .map((item) => ({
          id: item.id,
          store: item.store,
          storeName: item.storeName,
          name: item.name,
          price: item.price,
          image: item.image,
          url: item.url,
          sizes: item.sizes,
          variantId: isOneSize(item.sizes) ? item.sizes[0].variantId : null,
          qty: 1,
        }));
      return [...prev, ...added];
    });
  };

  /** Delete every render made from the photo, then start over. The cart has no photo data, so it stays. */
  const deletePhoto = async () => {
    if (!photo || !window.confirm("Delete your photo and every try-on made from it? Your looks will close.")) return;
    abort.current?.abort();
    sideAborts.current.forEach((c) => c.abort());
    sideAborts.current = [];
    const form = new FormData();
    form.set("photo", photo.blob, "photo.jpg");
    const res = await fetch("/api/photo/delete", { method: "POST", body: form }).catch(() => null);
    if (!res?.ok) {
      const message = res ? await errorFrom(res, "We couldn't delete your photo. Please try again.") : "We couldn't reach Wingman to delete your photo. Please try again.";
      if (phase === "error") setError({ code: "UNKNOWN", message });
      else setNotice(message);
      return;
    }
    setPhoto(null);
    setLooks([]);
    setParsed(null);
    setPrep(null);
    setCompares({});
    setSwapOptions({});
    setNotice(null);
    setPhotoNotice("Your photo and every try-on made from it are deleted.");
    resetTo("photo");
  };

  if (phase === "photo") {
    return (
      <PhotoStep
        photo={photo}
        onPhoto={(next) => {
          setPhotoNotice(null);
          setPhoto(next);
        }}
        onNext={() => go("occasion")}
        notice={photoNotice}
      />
    );
  }
  if (phase === "occasion") {
    return (
      <OccasionStep
        photo={photo}
        occasionId={occasionId}
        sentence={sentence}
        tier={tier}
        onOccasion={(id) => {
          // Swap the starter sentence only if the user hasn't written their own
          const typed = !OCCASION_CHOICES.some((o) => o.example === sentence) && sentence.trim() !== "";
          setOccasionId(id);
          if (!typed) setSentence(OCCASION_CHOICES.find((o) => o.id === id)!.example);
        }}
        onSentence={setSentence}
        onTier={setTier}
        onBack={() => (previous === "photo" ? back() : go("photo"))}
        onSubmit={run}
      />
    );
  }
  if (phase === "loading") {
    return (
      <LoadingStep
        photo={photo}
        progress={progress}
        refining={refining}
        looks={looks}
        settled={settled}
        retrying={retrying > 0}
        onRetry={retryImages}
        onContinue={skipMissingImages}
      />
    );
  }
  if (phase === "error" && error) {
    return (
      <ErrorStep
        code={error.code}
        message={error.message}
        onRetry={run}
        onNewPhoto={() => {
          setPhoto(null);
          returnTo("photo");
        }}
        onBack={() => returnTo("occasion")}
        onDeletePhoto={() => void deletePhoto()}
      />
    );
  }
  if (phase === "compare" && looks[comparing] && compares[comparing]) {
    return (
      <CompareStep
        look={looks[comparing]}
        state={compares[comparing]}
        photo={photo}
        onChoose={chooseVersion}
        onBack={back}
        backLabel={previous ? BACK_LABELS[previous] : undefined}
        onRetry={() => void startCompare(comparing)}
      />
    );
  }
  const swapLook = looks[swapping.look];
  if (phase === "swap" && swapLook) {
    return (
      <SwapStep
        look={swapLook}
        slot={swapping.slot}
        cheaper={swapping.cheaper}
        state={swapOptions[optionsKey(swapLook, swapping.slot, swapping.cheaper)] ?? { status: "loading", options: [] }}
        onPick={(option) => void applyPiece(swapping.look, option)}
        onBack={back}
        onRetry={() => void loadSwapOptions(swapLook, swapping.slot, swapping.cheaper)}
      />
    );
  }
  if (phase === "prep") {
    return (
      <PrepStep plan={prep?.plan ?? null} skinAnalysed={prep?.skinAnalysed ?? false} setting={parsed?.setting} onBack={back}
        backLabel={previous ? BACK_LABELS[previous] : undefined} />
    );
  }
  if (phase === "browse") {
    return (
      <BrowseStep
        filters={browseFilters}
        onFilters={setBrowseFilters}
        looks={looks}
        inCart={new Set(cart.map((l) => l.id))}
        onAddToLook={(index, item) => void applyPiece(index, item)}
        onAddToCart={(item) => addToCart([item])}
        onBack={back}
        backLabel={previous ? BACK_LABELS[previous] : undefined}
      />
    );
  }
  if (phase === "cart") {
    return (
      <CartStep
        lines={cart}
        onSize={(id, variantId) => setCart((prev) => prev.map((l) => (l.id === id ? { ...l, variantId } : l)))}
        onRemove={(id) => setCart((prev) => prev.filter((l) => l.id !== id))}
        onBack={back}
        backLabel={previous ? BACK_LABELS[previous] : undefined}
      />
    );
  }
  return (
    <LooksStep
      looks={looks}
      photo={photo}
      occasion={parsed}
      tier={tier}
      scoring={progress.step === "scoring" || looks.some((l) => !l.fitCheck)}
      notice={notice}
      onRestart={() => go("occasion")}
      onCompare={parsed ? openCompare : undefined}
      onSwap={parsed ? openSwap : undefined}
      onRefine={parsed ? refine : undefined}
      cart={cart}
      onAddToCart={(look) => {
        addToCart(look.items);
        go("cart");
      }}
      onViewCart={() => go("cart")}
      focusLook={focusLook}
      hasPrep={prep != null}
      onPrep={() => go("prep")}
      onBrowse={() => go("browse")}
      onDeletePhoto={() => void deletePhoto()}
    />
  );
}
