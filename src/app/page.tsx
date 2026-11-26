import Nav from "@/components/landing/Nav";
import Hero from "@/components/landing/Hero";
import DayTimeline from "@/components/landing/DayTimeline";
import Features from "@/components/landing/Features";
import AlertsShowcase from "@/components/landing/AlertsShowcase";
import StreakShowcase from "@/components/landing/StreakShowcase";
import { CTA, FAQ, Footer } from "@/components/landing/Closing";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <DayTimeline />
        <Features />
        <AlertsShowcase />
        <StreakShowcase />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
