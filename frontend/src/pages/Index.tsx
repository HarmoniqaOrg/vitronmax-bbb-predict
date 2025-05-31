
import Hero from '@/components/Hero';
import FeatureSection from '@/components/FeatureSection';
import { ModelInfo } from '@/components/ModelInfo';
import CallToAction from '@/components/CallToAction';

const Index = () => {
  return (
    <div className="flex flex-col min-h-screen">
      <Hero />
      <FeatureSection />

      {/* Model Performance Section */}
      <section id="model-performance" className="py-20 bg-muted/25">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Transparent & Validated Performance</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              We believe in transparency. Our model's performance has been rigorously evaluated to ensure reliability and accuracy.
            </p>
          </div>
          <ModelInfo />
        </div>
      </section>

      <CallToAction />
    </div>
  );
};

export default Index;
