
import { Beaker, Github } from 'lucide-react';

const Footer = () => {
  const year = new Date().getFullYear();
  
  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <a href="/" className="flex items-center gap-2 font-bold text-lg mb-4">
              <Beaker className="h-5 w-5 text-primary" />
              <span>VitronMax</span>
            </a>
            <p className="text-sm text-muted-foreground max-w-xs">
              Fast, explainable in-silico screening for Blood-Brain-Barrier permeability prediction.
            </p>
          </div>
          
          <div>
            <h3 className="font-medium mb-4">Navigation</h3>
            <ul className="space-y-2">
              <li>
                <a href="/" className="text-sm hover:underline">Home</a>
              </li>
              <li>
                <a href="/dashboard" className="text-sm hover:underline">Dashboard</a>
              </li>
              <li>
                <a href="/explain" className="text-sm hover:underline">AI Explain</a>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-medium mb-4">Resources</h3>
            <ul className="space-y-2">
              <li>
                <a 
                  href="https://github.com/vitronmax/vitronmax"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm hover:underline"
                >
                  <Github className="h-4 w-4" />
                  <span>GitHub</span>
                </a>
              </li>
              <li>
                <a href="/docs/api" className="text-sm hover:underline">
                  API Documentation
                </a>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="border-t mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm text-muted-foreground">
            © {year} VitronMax. All rights reserved.
          </p>
          <div className="flex gap-4 mt-4 md:mt-0">
            <a href="/privacy" className="text-sm text-muted-foreground hover:underline">
              Privacy Policy
            </a>
            <a href="/terms" className="text-sm text-muted-foreground hover:underline">
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
