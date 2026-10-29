import Image from "next/image";
import { cn } from "@/lib/utils/cn";
import { RAW_IMG_PROPS } from "./flow-shell";

/** A store's product photo on the light tile it was shot for. Size and shape come from `className`. */
export function ProductImage({ src, alt = "", sizes, className }: { src: string; alt?: string; sizes: string; className: string }) {
  return (
    <span className={cn("relative block shrink-0 overflow-hidden bg-[#d9d7d2]", className)}>
      <Image src={src} alt={alt} fill sizes={sizes} className="object-cover" {...RAW_IMG_PROPS} />
    </span>
  );
}
