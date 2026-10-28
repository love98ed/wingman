import { FitCheck } from "@/components/home/fit-check";
import { HeroWindow } from "@/components/home/hero-window";
import { HowItWorks } from "@/components/home/how-it-works";
import { LookFrames } from "@/components/home/look-frames";
import { OccasionPicker } from "@/components/home/occasion-picker";
import { SiteFooter } from "@/components/home/site-footer";
import { Reveal } from "@/components/shared/reveal";

const BEFORE = "/demo/before.jpg";
const AFTER = "/demo/after.jpg";

export default function Home() {
  return (
    <>
      <main className="overflow-x-clip">
        <HeroWindow before={BEFORE} after={AFTER} alt="Man in a white T-shirt" />
        <OccasionPicker />
        <LookFrames render={AFTER} />
        <FitCheck />
        <HowItWorks />
      </main>
      <SiteFooter render={AFTER} />
      <Reveal />
    </>
  );
}
