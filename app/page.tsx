import { BeforeAfter } from "@/components/home/before-after";
import { LookPreview } from "@/components/home/look-preview";
import { OccasionCta } from "@/components/home/occasion-cta";

const STEPS = [
  { n: "01", title: "Snap one photo", body: "Waist up, face to camera." },
  { n: "02", title: "Name the occasion", body: "One sentence and a budget." },
  { n: "03", title: "Wear it, buy it", body: "Styled on you, carted in one tap." },
];

export default function Home() {
  return (
    <div className="relative min-h-dvh overflow-x-hidden">
      {/* Ambient brass glow behind the hero */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgb(200_169_106/0.22),transparent_65%)] blur-2xl"
      />

      <main className="relative mx-auto flex w-full max-w-md flex-col gap-9 pt-[max(env(safe-area-inset-top),1rem)] pb-48">
        <header className="flex items-center justify-between px-5 pt-2">
          <span className="font-display text-2xl tracking-tight">Wingman</span>
          <span className="rounded-full border border-border px-2.5 py-1 font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
            AI Stylist
          </span>
        </header>

        <section className="animate-rise px-5">
          <BeforeAfter
            before="/demo/before.jpg"
            after="/demo/after.jpg"
            alt="Man in a white T-shirt"
            tags={["Camp collar shirt", "Slick back", "Rooftop date"]}
          />
        </section>

        <section className="animate-rise px-5 [animation-delay:120ms]">
          <h1 className="text-[52px] leading-[0.95]">
            Dressed for <em className="brass-text pr-1">the moment.</em>
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
            Tell Wingman where you&apos;re headed. Get full looks from real Singapore stores, styled on your own
            photo, with a grooming plan for the night before.
          </p>
        </section>

        <OccasionCta />

        <section aria-labelledby="sample-heading" className="animate-rise px-5 [animation-delay:360ms]">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 id="sample-heading" className="text-2xl">
              Your look, scored
            </h2>
            <span className="text-xs text-muted-foreground">Sample</span>
          </div>
          <LookPreview />
        </section>

        <section aria-labelledby="how-heading" className="px-5">
          <h2 id="how-heading" className="text-2xl">
            How it works
          </h2>
          <ol className="mt-4 grid gap-px overflow-hidden rounded-3xl border border-border bg-border">
            {STEPS.map((s) => (
              <li key={s.n} className="flex items-center gap-4 bg-surface px-5 py-4">
                <span className="font-display text-3xl text-brass italic">{s.n}</span>
                <div>
                  <p className="font-medium">{s.title}</p>
                  <p className="text-sm text-muted-foreground">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <p className="px-5 text-center text-xs leading-relaxed text-muted-foreground">
          Try-on and skin analysis by YouCam AI. Products from independent Singapore stores; you check out on their
          site. Your photo is deleted after 24 hours.
        </p>
      </main>
    </div>
  );
}
