
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Fingerprint, Database, Cpu, FileText, Zap, MessageSquare } from 'lucide-react';

const features = [
  {
    icon: <Fingerprint className="h-8 w-8 text-primary" />,
    title: "Molecular Fingerprints",
    description: "Utilizes Morgan fingerprints (ECFP4) with a radius of 2 and 2048 bits for optimal molecule representation.",
  },
  {
    icon: <Database className="h-8 w-8 text-primary" />,
    title: "Batch Processing",
    description: "Process thousands of molecules at once through CSV uploads with efficient asynchronous processing.",
  },
  {
    icon: <Cpu className="h-8 w-8 text-primary" />,
    title: "Machine Learning",
    description: "Powered by a Random Forest classifier trained on a curated dataset of BBB permeability data.",
  },
  {
    icon: <FileText className="h-8 w-8 text-primary" />,
    title: "PDF Reports",
    description: "Generate professional PDF reports with molecule information, predictions, and interpretation.",
  },
  {
    icon: <Zap className="h-8 w-8 text-primary" />,
    title: "High Performance",
    description: "Optimized for speed with sub-second response times and efficient database interactions.",
  },
  {
    icon: <MessageSquare className="h-8 w-8 text-primary" />,
    title: "AI Explanations",
    description: "Get detailed explanations of predictions from our AI system to understand key molecular factors.",
  },
];

const FeatureSection = () => {
  return (
    <section className="py-20 bg-muted/25">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4">Key Features</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            VitronMax combines cutting-edge machine learning with molecular modeling to deliver
            accurate BBB permeability predictions with comprehensive explanations.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="border transition-all hover:shadow-md">
              <CardHeader>
                <div className="mb-4">
                  {feature.icon}
                </div>
                <CardTitle>{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeatureSection;
