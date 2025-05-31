
import Hero from '@/components/Hero';
import FeatureSection from '@/components/FeatureSection';
import { ModelInfo } from '@/components/ModelInfo';
import CallToAction from '@/components/CallToAction';

const Index = () => {
  return (
    <div className="flex flex-col min-h-screen">
      <Hero />
      <FeatureSection />
      <div className="container mx-auto px-4 md:px-6">
        <ModelInfo />
      </div>
      <CallToAction />
    </div>
  );
};

export default Index;
