import Image from "next/image";
import Link from "next/link";

const MENU = [
  { label: "Style me", href: "/style" },
  { label: "Pick the night", href: "#looks" },
  { label: "Three budgets", href: "#budgets" },
  { label: "Fit check", href: "#fit" },
  { label: "How it works", href: "#how" },
  { label: "The stores", href: "#stores" },
];

/** A designed close: the render, closer than anywhere above, beside the menu set large. */
export function SiteFooter({ render }: { render: string }) {
  return (
    <footer className="relative z-10 grid bg-background md:min-h-svh md:grid-cols-12">
      <div data-shutter className="relative h-[50svh] overflow-hidden md:col-span-6 md:h-auto">
        <div className="absolute inset-0 origin-[50%_22%] scale-[1.35]">
          <Image
            src={render}
            alt="Close-up of the styled render"
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover object-[50%_20%]"
          />
        </div>
      </div>

      <div className="flex flex-col px-(--margin) pt-12 pb-8 md:col-span-5 md:col-start-8 md:pt-20 md:pl-0">
        <p className="font-display text-small uppercase">Wingman</p>

        <nav aria-label="Footer" className="mt-6">
          <ul className="group/menu flex flex-col gap-5 md:gap-7">
            {MENU.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="-my-2 inline-block py-2 text-head leading-none font-medium tracking-[-0.02em] transition-[color,transform] duration-200 ease-(--ease-out) group-hover/menu:text-muted-foreground hover:translate-x-3 hover:!text-ivory"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-16 grid gap-6 sm:grid-cols-2">
          <p>
            Try-on and skin analysis by YouCam AI. Products from independent Singapore stores; you check out on their
            site.
          </p>
          <p>Your photo is never stored, and your try-ons are deleted after 24 hours.</p>
        </div>

        <p className="mt-auto pt-16 text-small text-muted-foreground">
          Wingman, built for the YouCam API hackathon. Model photo by MART PRODUCTION on Pexels; every try-on on this
          page is a real YouCam render, in pieces from Colony Clothing, Kevin Seah and Pharaoh&apos;s Horses.
        </p>
      </div>
    </footer>
  );
}
