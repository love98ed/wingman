"use client";

import { FlowShell } from "@/components/style/flow-shell";
import type { PrepPlan } from "@/lib/agent/schemas";

/** The three-step grooming routine for the night before, from skin analysis when it worked. */
export function PrepStep({
  plan,
  skinAnalysed,
  setting,
  onBack,
  backLabel = "Back to your looks",
}: {
  plan: PrepPlan | null;
  skinAnalysed: boolean;
  setting?: string;
  onBack: () => void;
  /** Names the screen the back button returns to. */
  backLabel?: string;
}) {
  return (
    <FlowShell step="Prep plan">
      <h1 className="mt-4 text-head">The night before</h1>
      <p className="mt-4">
        {plan
          ? `Three things to do the evening before${setting ? ` the ${setting}` : ""}, so you show up looking rested.`
          : "Your plan is still being written. It arrives a few seconds after your looks."}
      </p>

      {plan && (
        <ol className="mt-8 flex flex-col gap-2">
          {plan.steps.map((step, i) => (
            <li key={step.title} className="bg-surface p-5">
              <h2 className="text-lead">
                <span className="sr-only">Step {i + 1}: </span>
                {step.title}
              </h2>
              <p className="mt-2">{step.detail}</p>
            </li>
          ))}
        </ol>
      )}

      {plan && (
        <p className="mt-8 text-small text-muted-foreground">
          {skinAnalysed
            ? "Tailored to a skin reading from your photo. "
            : "We couldn't read your skin from this photo (an angle or glasses can do that), so these are general tips. "}
          Grooming tips only, not medical advice.
        </p>
      )}

      <button type="button" onClick={onBack} className="text-link mt-6 min-h-11 text-muted-foreground">
        {backLabel}
      </button>
    </FlowShell>
  );
}
