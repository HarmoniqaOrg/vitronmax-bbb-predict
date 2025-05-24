
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Hero = () => {
  return (
    <div className="relative w-full py-16 md:py-24 lg:py-32 grid-pattern">
      <div className="container mx-auto px-4 text-center">
        <div className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-6">
          Fast, Accurate, Explainable
        </div>
        
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
          Blood-Brain-Barrier
          <span className="block text-primary">Permeability Prediction</span>
        </h1>
        
        <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-10">
          Accelerate your drug discovery pipeline with VitronMax's state-of-the-art
          in-silico BBB permeability screening platform.
        </p>
        
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
          <Button size="lg">
            <a href="/dashboard" className="flex items-center">
              Try Now <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
          
          <Button variant="outline" size="lg">
            <a href="/explain">
              AI Explanations
            </a>
          </Button>
        </div>
        
        <div className="mt-16 px-4 py-8 bg-card border rounded-lg max-w-3xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div className="space-y-2">
              <h3 className="font-medium text-xl">Prediction Rate</h3>
              <p className="text-3xl font-bold text-primary">95%+</p>
              <p className="text-sm text-muted-foreground">Accuracy on validation data</p>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-medium text-xl">Response Time</h3>
              <p className="text-3xl font-bold text-primary">&lt;800ms</p>
              <p className="text-sm text-muted-foreground">95th percentile latency</p>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-medium text-xl">API-First</h3>
              <p className="text-3xl font-bold text-primary">REST API</p>
              <p className="text-sm text-muted-foreground">Easy integration</p>
            </div>
          </div>
        </div>
      </div>
      
      <div
        className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
        aria-hidden="true"
      >
        <div
          className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-primary to-[#9089fc] opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
          style={{
            clipPath:
              'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
          }}
        />
      </div>
    </div>
  );
};

export default Hero;
