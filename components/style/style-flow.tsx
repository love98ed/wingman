"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readEvents, type CompareEvent, type Look, type StyleStep, type TierVersion } from "@/lib/agent/events";
import type { ParsedOccasion } from "@/lib/agent/schemas";
import type { Occasion, Tier } from "@/lib/catalog/types";
import { OCCASION_CHOICES } from "@/lib/occasions";
import { CompareStep, versionOf, type CompareState } from "./compare-step";
import { ErrorStep } from "./error-step";
import { LoadingStep } from "./loading-step";
import { LooksStep } from "./looks-step";
import { OccasionStep } from "./occasion-step";
import { PhotoStep } from "./photo-step";

export type Photo = { blob: Blob; url: string };
export type Progress = { step: StyleStep; detail?: string };
type Phase = "photo" | "occasion" | "loading" | "looks" | "compare" | "error";

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
  /** Price Compare per look index; kept so reopening a comparison is instant. */
  const [compares, setCompares] = useState<Record<number, CompareState>>({});
  const [comparing, setComparing] = useState(0);
  const abort = useRef<AbortController | null>(null);
  const compareAborts = useRef<AbortController[]>([]);

  // Each step is its own screen: start it at the top
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [phase]);
  useEffect(
    () => () => {
      abort.current?.abort();
      compareAborts.current.forEach((c) => c.abort());
    },
    [],
  );
  useEffect(
    () => () => {
      if (photo) URL.revokeObjectURL(photo.url);
    },
    [photo],
  );

  const fail = (code: string, message: string) => {
    setError({ code, message });
    setPhase("error");
  };

  const run = useCallback(async () => {
    if (!photo) return setPhase("photo");
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    compareAborts.current.forEach((c) => c.abort());
    compareAborts.current = [];
    setCompares({});
    setLooks([]);
    setParsed(null);
    setProgress({ step: "reading" });
    setPhase("loading");

    const form = new FormData();
    form.set("photo", photo.blob, "photo.jpg");
    form.set("occasion", sentence);
    form.set("tier", tier);

    try {
      const res = await fetch("/api/style", { method: "POST", body: form, signal: controller.signal });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        return fail("UNKNOWN", body.error ?? "Something went wrong while styling. Please try again.");
      }
      let gotResult = false;
      await readEvents(res.body, (event) => {
        switch (event.type) {
          case "progress":
            setProgress({ step: event.step, detail: event.detail });
            // Renders all failed: nothing will trigger the switch below, so show the looks now
            if (event.step === "scoring") setPhase((p) => (p === "loading" ? "looks" : p));
            break;
          case "looks":
            setParsed(event.occasion);
            setLooks(event.looks);
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
            gotResult = true;
            setLooks(event.result.looks);
            setPhase("looks");
            break;
          case "error":
            fail(event.code, event.message);
            break;
        }
      });
      if (!gotResult && !controller.signal.aborted) {
        setPhase((p) => (p === "error" ? p : "looks"));
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error(err);
      fail("UNKNOWN", "We lost the connection while styling. Please try again.");
    }
  }, [photo, sentence, tier]);

  const startCompare = async (index: number) => {
    const look = looks[index];
    if (!photo || !look || !parsed) return;
    const controller = new AbortController();
    compareAborts.current.push(controller);
    const update = (fn: (state: CompareState) => CompareState) =>
      setCompares((prev) => ({ ...prev, [index]: fn(prev[index] ?? { versions: {}, status: "loading" }) }));
    const patch = (tier: TierVersion["tier"], fn: (v: TierVersion) => TierVersion) =>
      update((s) => (s.versions[tier] ? { ...s, versions: { ...s.versions, [tier]: fn(s.versions[tier]!) } } : s));
    setCompares((prev) => ({ ...prev, [index]: { versions: {}, status: "loading" } }));

    const form = new FormData();
    form.set("photo", photo.blob, "photo.jpg");
    form.set(
      "look",
      JSON.stringify({
        name: look.name,
        tier: look.tier,
        items: look.items.map((i) => ({ slot: i.slot, id: i.id })),
        hair: look.hair,
        occasion: parsed,
      }),
    );
    try {
      const res = await fetch("/api/compare", { method: "POST", body: form, signal: controller.signal });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        return update((s) => ({ ...s, status: "error", error: body.error ?? "We couldn't compare prices for this look." }));
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
  if (phase === "loading") return <LoadingStep photo={photo} progress={progress} />;
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
  return (
    <LooksStep
      looks={looks}
      photo={photo}
      occasion={parsed}
      tier={tier}
      scoring={progress.step === "scoring" || looks.some((l) => !l.fitCheck)}
      onRestart={() => setPhase("occasion")}
      onCompare={parsed ? openCompare : undefined}
    />
  );
}
