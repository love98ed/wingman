import Image from "next/image";
import Link from "next/link";

/** Placeholder for screens built in later steps, so links never 404. */
export function ComingSoon({ title, body }: { title: string; body: string }) {
  return (
    <main className="grid min-h-dvh md:grid-cols-12">
      <div className="relative h-[42svh] overflow-hidden md:order-2 md:col-span-6 md:col-start-7 md:h-auto">
        <Image
          src="/demo/after.jpg"
          alt="The sample look, styled on a photo"
          fill
          priority
          sizes="(min-width: 768px) 50vw, 100vw"
          className="object-cover object-[50%_22%]"
        />
      </div>
      <div className="flex flex-col px-(--margin) pt-10 pb-[max(env(safe-area-inset-bottom),2rem)] md:col-span-5 md:justify-center md:py-20">
        <Link href="/" className="inline-flex min-h-11 items-center self-start font-display text-small uppercase">
          Wingman
        </Link>
        <h1 className="mt-10 text-head">{title}</h1>
        <p className="mt-6 max-w-[38ch]">{body}</p>
        <p className="mt-4 text-small text-muted-foreground">This screen is still being built.</p>
        <Link href="/" className="btn mt-10 w-full md:w-auto md:self-start">
          Back to home
        </Link>
      </div>
    </main>
  );
}
