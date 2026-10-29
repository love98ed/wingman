import Link from "next/link";
import { FlowShell } from "@/components/style/flow-shell";

export default function NotFound() {
  return (
    <FlowShell step="Not found">
      <h1 className="mt-4 text-head">Nothing here</h1>
      <p className="mt-4 max-w-[36ch]">That page doesn&apos;t exist. Start with a photo and Wingman will dress you for the occasion.</p>
      <div className="mt-8 flex flex-col gap-2">
        <Link href="/style" className="btn w-full">
          Start with a photo
        </Link>
        <Link href="/" className="text-link flex min-h-11 items-center justify-center text-muted-foreground">
          Back to the home page
        </Link>
      </div>
    </FlowShell>
  );
}
