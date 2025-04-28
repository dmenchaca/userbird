import { useState } from 'react'
import { Check, Loader } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Custom CSS for faster spinning animation
const fastSpinStyle = `
  @keyframes fast-spin {
    to {
      transform: rotate(360deg);
    }
  }
  .animate-fast-spin {
    animation: fast-spin 0.6s linear infinite;
  }
`;

export default function Step5Test() {
  const [loadingStep, setLoadingStep] = useState(0)
  const [isTestRunning, setIsTestRunning] = useState(false)
  
  const loadingSteps = [
    "Creating your workspace",
    "Loading sample support tickets",
    "Enabling AI to auto-label your feedback"
  ]

  // Function to run the test animation sequence
  const runTestAnimation = async () => {
    setIsTestRunning(true)
    setLoadingStep(0)
    
    // Step 1
    await new Promise(resolve => setTimeout(resolve, 2000));
    setLoadingStep(1)
    
    // Step 2
    await new Promise(resolve => setTimeout(resolve, 1500));
    setLoadingStep(2)
    
    // Step 3
    await new Promise(resolve => setTimeout(resolve, 1000));
    setLoadingStep(3)
    
    // Complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsTestRunning(false)
  }

  return (
    <div className="h-screen bg-background/90 backdrop-blur-sm flex items-center justify-center p-4">
      {/* Add style tag for custom animation */}
      <style dangerouslySetInnerHTML={{ __html: fastSpinStyle }} />
      
      <div className="bg-background rounded-lg shadow-lg border w-full max-w-xl p-8 py-10">
        <div>
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-10">
              <h2 className="text-2xl font-semibold text-center">Setting up your workspace</h2>
            </div>

            <div className="space-y-6 max-w-md mx-auto">
              {loadingSteps.map((step, index) => (
                <div 
                  key={index} 
                  className={`flex items-center transition-opacity duration-300 ${
                    loadingStep < index ? 'opacity-40' : 'opacity-100'
                  }`}
                >
                  <div className="mr-4 h-6 w-6 flex-shrink-0">
                    {loadingStep > index ? (
                      <div className="rounded-full h-6 w-6 bg-green-500 text-white flex items-center justify-center">
                        <Check className="h-3.5 w-3.5" />
                      </div>
                    ) : loadingStep === index ? (
                      <div className="rounded-full h-6 w-6 border-2 border-primary/30 border-t-primary animate-fast-spin"></div>
                    ) : (
                      <div className="rounded-full h-6 w-6 border-2 border-muted"></div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium ${loadingStep >= index ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {step}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-10 flex justify-center">
              <Button 
                onClick={runTestAnimation} 
                disabled={isTestRunning}
                className="w-full max-w-sm mx-auto"
              >
                {isTestRunning ? (
                  <>
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    Running test...
                  </>
                ) : (
                  'Run animation test'
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 