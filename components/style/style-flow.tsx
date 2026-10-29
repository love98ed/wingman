"use client";

import { useEffect, useRef, useState } from "react";
import {
  readEvents,
  type CompareEvent,
  type Look,
  type LookItem,
  type StyleEvent,
  type StyleStep,
  type SwapEvent,
  type TierVersion,
} from "@/lib/agent/events";
import type { ParsedOccasion } from "@/lib/agent/schemas";
import type { Occasion, Tier } from "@/lib/catalog/types";
import { OCCASION_CHOICES } from "@/lib/occasions";
import { CompareStep, versionOf, type CompareState } from "./compare-step";
import { ErrorStep } from "./error-step";
import { LoadingStep } from "./loading-step";
import { LooksStep } from "./looks-step";
import { OccasionStep } from "./occasion-step";
import { PhotoStep } from "./photo-step";
import { showsInRender, SwapStep, type SwapOptionsState } from "./swap-step";

export type Photo = { blob: Blob; url: string };
export type Progress = { step: StyleStep; detail?: string };
type Phase = "photo" | "occasion" | "loading" | "looks" | "compare" | "swap" | "error";
type Slot = LookItem["slot"];

/** The ids of a look's pieces: swap alternatives are cached per look and slot. */
const signature = (look: Look) => look.items.map((i) => i.id).join(",");
const roundTotal = (items: LookItem[]) => Math.round(items.reduce((sum, i) => sum + i.price, 0) * 100) / 100;

/** Read an error body from a failed JSON or stream request. */
const errorFrom = async (res: Response, fallback: string) =>
  ((await res.json().catch(() => ({}))) as { error?: string }).error ?? fallback;

/** Photo, then occasion, then a streamed styling run that lands on the looks. */
export function StyleFlow({ initialOccasion }: { initialOccasion?: Occasion }) {
  const start = OCCASION_CHOICES.find((o) => o.id === initialOccasion) ?? OCCASION_CHOICES[0];
  const [phase, setPhase] = useState<Phase>("photo");
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [occasionId, setOccasionId] = useState<Occasion>(start.id);
  const [sentence, setSentence] = useState(start.example);
  const [tier, setTier] = useState<Tier>("mid");
  const [progress, setProgress] = useState<Progress>({ step: "reading" });
  const [looks, setLooks] = useState<Look[]>([]);
  const [parsed, setParsed] = useState<ParsedOccasion | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  /** The request being applied while the loading screen shows a refine. */
  const [refining, setRefining] = useState<string | null>(null);
  /** A refine or swap that failed; the looks stay as they were. */
  const [notice, setNotice] = useState<string | null>(null);
  /** Price Compare per look index; kept so reopening a comparison is instant. */
  const [compares, setCompares] = useState<Record<number, CompareState>>({});
  const [comparing, setComparing] = useState(0);
  const [swapping, setSwapping] = useState<{ look: number; slot: Slot }>({ look: 0, slot: "top" });
  const [swapOptions, setSwapOptions] = useState<Record<string, SwapOptionsState>>({});
  const abort = useRef<AbortController | null>(null);
  /** Compares and swaps in flight; a new run or refine cancels them. */
  const sideAborts = useRef<AbortController[]>([]);
  /** Latest swap per look, so a slower earlier swap can't overwrite a newer one. */
  const swapTokens = useRef<Record<number, number>>({});

  // Each step is its own screen: start it at the top
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [phase]);
  useEffect(
    () => () => {
      abort.current?.abort();
      sideAborts.current.forEach((c) => c.abort());
    },
    [],
  );
  useEffect(
    () => () => {
      if (photo) URL.revokeObjectURL(photo.url);
    },
    [photo],
  );

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
    setPhase("loading");

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
            // Renders all failed: nothing will trigger the switch below, so show the looks now
            if (event.step === "scoring") setPhase((p) => (p === "loading" ? "looks" : p));
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
            // The first outfit on screen beats waiting for every render
            if (event.kind === "outfit") setPhase((p) => (p === "loading" ? "looks" : p));
            break;
          case "fitcheck":
            setLooks((prev) => prev.map((look, i) => ({ ...look, fitCheck: event.checks[i] ?? look.fitCheck })));
            break;
          case "result":
            setLooks(event.result.looks);
            break;
          case "error":
            failed = true;
            onFail(event.code, event.message);
            break;
        }
      });
      // Leave the user where they are if they already moved on to compare or swap
      if (!failed && !controller.signal.aborted) setPhase((p) => (p === "loading" ? "looks" : p));
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error(err);
      onFail("UNKNOWN", "We lost the connection while styling. Please try again.");
    } finally {
      if (abort.current === controller) setRefining(null);
    }
  };

  const run = () => {
    if (!photo) return setPhase("photo");
    setLooks([]);
    setParsed(null);
    setCompares({});
    setSwapOptions({});
    const form = new FormData();
    form.set("photo", photo.blob, "photo.jpg");
    form.set("occasion", sentence);
    form.set("tier", tier);
    void streamLooks("/api/style", form, (code, message) => {
      setError({ code, message });
      setPhase("error");
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
      setPhase("looks");
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
    setPhase("compare");
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
    setPhase("looks");
  };

  const loadSwapOptions = async (look: Look, slot: Slot) => {
    const key = `${signature(look)}|${slot}`;
    const controller = sideController();
    setSwapOptions((prev) => ({ ...prev, [key]: { status: "loading", options: [] } }));
    try {
      const res = await fetch("/api/swap/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...lookRef(look), slot }),
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

  const openSwap = (index: number, slot: Slot) => {
    setSwapping({ look: index, slot });
    setPhase("swap");
    const state = swapOptions[`${signature(looks[index])}|${slot}`];
    if (!state || state.status === "error") void loadSwapOptions(looks[index], slot);
  };

  /**
   * Put the new piece in at once (items and total update live), then stream the new try-on
   * and Fit Check. Only a swap of the garment on top clears the render while it re-renders.
   */
  const applySwap = async (option: LookItem) => {
    const { look: index, slot } = swapping;
    const before = looks[index];
    if (!photo || !before) return;
    const items = before.items.map((i) => (i.slot === slot ? option : i));
    const rerender = showsInRender(before, slot);
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
      renders: rerender ? { beard: before.renders.beard, errors: [] } : before.renders,
    };
    setLooks((prev) => prev.map((l, i) => (i === index ? swapped : l)));
    // The comparison was for the old pieces
    setCompares((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
    setNotice(null);
    setPhase("looks");

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

  if (phase === "photo") {
    return <PhotoStep photo={photo} onPhoto={setPhoto} onNext={() => setPhase("occasion")} />;
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
        onBack={() => setPhase("photo")}
        onSubmit={run}
      />
    );
  }
  if (phase === "loading") return <LoadingStep photo={photo} progress={progress} refining={refining} />;
  if (phase === "error" && error) {
    return (
      <ErrorStep
        code={error.code}
        message={error.message}
        onRetry={run}
        onNewPhoto={() => {
          setPhoto(null);
          setPhase("photo");
        }}
        onBack={() => setPhase("occasion")}
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
        onBack={() => setPhase("looks")}
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
        state={swapOptions[`${signature(swapLook)}|${swapping.slot}`] ?? { status: "loading", options: [] }}
        onPick={(option) => void applySwap(option)}
        onBack={() => setPhase("looks")}
        onRetry={() => void loadSwapOptions(swapLook, swapping.slot)}
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
      onRestart={() => setPhase("occasion")}
      onCompare={parsed ? openCompare : undefined}
      onSwap={parsed ? openSwap : undefined}
      onRefine={parsed ? refine : undefined}
    />
  );
}
