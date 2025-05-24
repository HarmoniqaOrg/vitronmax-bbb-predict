
import Hero from '@/components/Hero';
import FeatureSection from '@/components/FeatureSection';
import CallToAction from '@/components/CallToAction';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Hero />
      <FeatureSection />
      <CallToAction />
    </div>
  );
}
