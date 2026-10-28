import Link from "next/link";

/** Placeholder for screens built in later steps, so links never 404. */
export function ComingSoon({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
      <p className="text-[11px] font-medium tracking-[0.2em] text-brass uppercase">Coming soon</p>
      <h1 className="mt-3 text-5xl leading-none">{title}</h1>
      <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">{body}</p>
      <Link
        href="/"
        className="mt-10 flex h-12 items-center justify-center rounded-2xl border border-border text-sm text-ivory/80 hover:border-ivory/30"
      >
        Back to home
      </Link>
    </main>
  );
}
