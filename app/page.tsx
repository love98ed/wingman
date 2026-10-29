import { Budgets } from "@/components/home/budgets";
import { FitCheck } from "@/components/home/fit-check";
import { HeroWindow } from "@/components/home/hero-window";
import { HowItWorks } from "@/components/home/how-it-works";
import { BEFORE, OCCASION_LOOKS } from "@/components/home/looks-data";
import { OccasionPicker } from "@/components/home/occasion-picker";
import { SiteFooter } from "@/components/home/site-footer";
import { Stores } from "@/components/home/stores";
import { Reveal } from "@/components/shared/reveal";

export default function Home() {
  return (
    <>
      <main className="overflow-x-clip">
        <HeroWindow before={BEFORE} after={OCCASION_LOOKS.wedding.render} alt="Man in a white T-shirt" />
        <OccasionPicker />
        <Budgets />
        <FitCheck />
        <HowItWorks />
        <Stores />
      </main>
      <SiteFooter render={OCCASION_LOOKS.cny.render} />
      <Reveal />
    </>
  );
}
