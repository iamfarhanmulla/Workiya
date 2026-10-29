import CheckInCard from "@/components/marketing/features/CheckInCard";
import FeatureSwipe from "@/components/marketing/features/FeatureSwipe";
import ManagerCard from "@/components/marketing/features/ManagerCard";
import PlanCard from "@/components/marketing/features/PlanCard";
import ReviewCard from "@/components/marketing/features/ReviewCard";
import RulesCard from "@/components/marketing/features/RulesCard";
import Hero from "@/components/marketing/Hero";
import LabelsSection from "@/components/marketing/LabelsSection";
import LandingFooter, { CtaBand } from "@/components/marketing/LandingFooter";
import LandingNav from "@/components/marketing/LandingNav";
import PromiseSection from "@/components/marketing/PromiseSection";
import RevealController from "@/components/marketing/RevealController";
import RolesMarquee from "@/components/marketing/RolesMarquee";

export const metadata = {
  title: "WorKiya Field Visits",
  description: "WorKiya: one app to plan, check in, prove and review every field visit.",
};

export default function LandingPage() {
  return (
    <div className="wkm wkm-landing">
      <LandingNav />
      <main id="top">
        <Hero />
        <RolesMarquee />
        <FeatureSwipe>
          <PlanCard />
          <CheckInCard />
          <RulesCard />
          <ReviewCard />
          <ManagerCard />
        </FeatureSwipe>
        <LabelsSection />
        <PromiseSection />
      </main>
      <CtaBand />
      <LandingFooter />
      <RevealController />
    </div>
  );
}
