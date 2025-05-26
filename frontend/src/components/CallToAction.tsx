import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

const CallToAction = () => {
  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">
            Ready to accelerate your drug discovery process?
          </h2>
          <p className="text-lg text-muted-foreground mb-10">
            Try VitronMax today and get instant predictions for your compounds.
            Our API-first approach means you can integrate our service into your
            existing workflow with ease.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-xl mx-auto">
            <Button size="lg" className="w-full">
              <a href="/dashboard" className="flex items-center justify-center w-full">
                Try Dashboard <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button variant="outline" size="lg" className="w-full">
              <a 
                href="https://github.com/HarmoniqaOrg/vitronmax-bbb-predict/blob/main/docs/API-documentation.md" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center justify-center w-full"
              >
                API Documentation
              </a>
            </Button>
          </div>
          
          <div className="mt-16 p-6 bg-muted rounded-lg">
            <p className="font-medium mb-2">Need custom integration or support?</p>
            <p className="text-sm text-muted-foreground mb-4">
              Our team is ready to help you integrate VitronMax into your drug discovery pipeline.
            </p>
            <Button variant="link">
              <a href="mailto:contact@vitronmax.com">Contact Us</a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CallToAction;
