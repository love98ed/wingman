import Link from "next/link";

const MENU = [
  { label: "Style me", href: "/style" },
  { label: "Pick the night", href: "#looks" },
  { label: "Three budgets", href: "#budgets" },
  { label: "Fit check", href: "#fit" },
  { label: "How it works", href: "#how" },
  { label: "The stores", href: "#stores" },
];

/** A designed close: the name at full width over the menu set large. No picture, so none repeats. */
export function SiteFooter() {
  return (
    <footer className="relative z-10 bg-background px-(--margin) pt-20 pb-8 md:pt-32">
      <p aria-hidden className="font-display text-[12vw] leading-[0.85] tracking-[-0.03em] uppercase">
        Wingman
      </p>

      <div className="mt-14 grid gap-14 md:mt-20 md:grid-cols-12 md:gap-6">
        <nav aria-label="Footer" className="md:col-span-6">
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

        <div className="flex flex-col gap-6 md:col-span-5 md:col-start-8 md:justify-end">
          <p>
            Try-on and skin analysis by YouCam AI. Products from independent Singapore stores; you check out on their
            site.
          </p>
          <p>Your photo is never stored, and your try-ons are deleted after 24 hours.</p>
        </div>
      </div>

      <p className="mt-20 max-w-[64ch] text-small text-muted-foreground md:mt-28">
          Wingman, built for the YouCam API hackathon. Model photo by MART PRODUCTION on Pexels; every try-on on this
          page is a real YouCam render, in pieces from Colony Clothing, Kevin Seah and Pharaoh&apos;s Horses.
      </p>
    </footer>
  );
}
