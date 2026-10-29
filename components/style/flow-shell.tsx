import Link from "next/link";
import { cn } from "@/lib/utils";

/** Shared frame for the style flow: wordmark, where you are, one phone-width column. */
export function FlowShell({
  step,
  children,
  wide = false,
}: {
  step?: string;
  children: React.ReactNode;
  /** The looks carousel uses the full width on larger screens. */
  wide?: boolean;
}) {
  return (
    <div className="min-h-dvh pb-[max(env(safe-area-inset-bottom),2rem)]">
      <header className="mx-auto flex h-16 max-w-xl items-center justify-between px-(--margin) pt-[env(safe-area-inset-top)]">
        <Link href="/" className="font-display text-small uppercase">
          Wingman
        </Link>
        {step && <span className="text-right text-small text-muted-foreground">{step}</span>}
      </header>
      <main className={cn("mx-auto px-(--margin)", wide ? "max-w-5xl" : "max-w-xl")}>{children}</main>
    </div>
  );
}

/** Data URL or blob URL images skip next/image optimisation. */
export const RAW_IMG_PROPS = { unoptimized: true } as const;
