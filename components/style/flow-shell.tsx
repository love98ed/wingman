import Link from "next/link";
import { cn } from "@/lib/utils/cn";

/** Shared frame for the style flow: wordmark, where you are, one phone-width column. */
export function FlowShell({
  step,
  children,
  wide = false,
  back,
}: {
  step?: string;
  children: React.ReactNode;
  /** A back link above the page: to a URL, or a step in the flow. */
  back?: { label: string; href?: string; onClick?: () => void };
  /** The looks carousel uses the full width on larger screens. */
  wide?: boolean;
}) {
  return (
    <div className="min-h-dvh pb-[max(env(safe-area-inset-bottom),2rem)]">
      <header
        className={cn(
          "mx-auto flex h-16 items-center justify-between px-(--margin) pt-[env(safe-area-inset-top)]",
          wide ? "max-w-5xl" : "max-w-xl",
        )}
      >
        <Link href="/" className="inline-flex min-h-11 items-center font-display text-small uppercase">
          Wingman
        </Link>
        {step && <span className="text-right text-small text-muted-foreground">{step}</span>}
      </header>
      <main className={cn("mx-auto px-(--margin)", wide ? "max-w-5xl" : "max-w-xl")}>
        {back && <BackLink {...back} />}
        {children}
      </main>
    </div>
  );
}

function BackLink({ label, href, onClick }: { label: string; href?: string; onClick?: () => void }) {
  const className = "text-link -ml-1 inline-flex min-h-11 items-center gap-1.5 text-muted-foreground";
  const content = (
    <>
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
        <path d="M15 5l-7 7 7 7" />
      </svg>
      {label}
    </>
  );
  return href ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}

/** Data URL or blob URL images skip next/image optimisation. */
export const RAW_IMG_PROPS = { unoptimized: true } as const;
