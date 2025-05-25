
import Hero from '@/components/Hero';
import FeatureSection from '@/components/FeatureSection';
import CallToAction from '@/components/CallToAction';

const Index = () => {
  return (
    <div className="flex flex-col min-h-screen">
      <Hero />
      <FeatureSection />
      <CallToAction />
    </div>
  );
};

export default Index;
