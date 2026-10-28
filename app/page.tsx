import { Button } from "@/components/ui/button";

const steps = [
  { n: "01", title: "Your photo", body: "One waist-up shot, face clear." },
  { n: "02", title: "The occasion", body: "One sentence and a budget." },
  { n: "03", title: "Your looks", body: "Styled on you, ready to buy." },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-[max(env(safe-area-inset-top),1.5rem)]">
      <header className="flex items-center justify-between">
        <span className="text-sm font-semibold tracking-tight">Wingman</span>
        <span className="font-mono text-xs text-muted-foreground">SGD</span>
      </header>

      <section className="mt-16">
        <p className="text-xs font-medium tracking-[0.2em] text-brass uppercase">
          Occasion stylist
        </p>
        <h1 className="mt-3 text-4xl leading-[1.05]">
          Tell us the occasion. See yourself ready.
        </h1>
        <p className="mt-4 text-base text-muted-foreground">
          A full look from real Singapore stores, styled on your photo and one
          tap from checkout.
        </p>
      </section>

      <ol className="mt-10 grid gap-3">
        {steps.map((s) => (
          <li
            key={s.n}
            className="flex items-start gap-4 rounded-xl border bg-surface p-4"
          >
            <span className="font-mono text-sm text-brass">{s.n}</span>
            <div>
              <p className="font-medium">{s.title}</p>
              <p className="text-sm text-muted-foreground">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="sticky bottom-0 mt-auto grid gap-3 bg-gradient-to-t from-background from-70% to-transparent pt-8 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
        <Button size="lg" className="w-full">
          Get styled
        </Button>
        <Button size="lg" variant="outline" className="w-full">
          Try the demo
        </Button>
      </div>
    </main>
  );
}
