import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'

interface InstallInstructionsModalProps {
  formId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InstallInstructionsModal({ formId, open, onOpenChange }: InstallInstructionsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Installation Instructions</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="html" className="w-full overflow-hidden">
          <TabsList>
            <TabsTrigger value="html">HTML/JavaScript</TabsTrigger>
            <TabsTrigger value="react">React</TabsTrigger>
          </TabsList>

          <TabsContent value="html" className="space-y-4 overflow-hidden">
            <div>
              <h3 className="text-lg font-semibold mb-2">HTML/JavaScript Integration</h3>
              <p className="text-sm text-muted-foreground mb-4">Add this code to your HTML:</p>
              <div className="relative">
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto max-h-[400px] text-sm">
                <code>{`<!-- Option 1: Use our default trigger button -->
<button id="userbird-trigger-${formId}">Feedback</button>

<!-- Option 2: Use your own trigger button -->
<button onclick="UserBird.open()">Custom Feedback Button</button>

<!-- Initialize Userbird -->
<script>
  (function(w,d,s){
    w.UserBird = w.UserBird || {};
    w.UserBird.formId = "${formId}";
    s = d.createElement('script');
    s.src = 'https://userbird.netlify.app/widget.js';
    d.head.appendChild(s);
  })(window,document);
</script>`}</code>
                </pre>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="react" className="space-y-4 overflow-hidden">
            <div>
              <h3 className="text-lg font-semibold mb-2">React Integration</h3>
              <p className="text-sm text-muted-foreground mb-4">Initialize the widget in your React component:</p>
              <div className="relative">
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto max-h-[400px] text-sm">
                <code>{`import { useEffect } from 'react';

function App() {
  useEffect(() => {
    // Initialize Userbird
    window.UserBird = window.UserBird || {};
    window.UserBird.formId = "${formId}";
    
    const script = document.createElement('script');
    script.src = 'https://userbird.netlify.app/widget.js';
    document.head.appendChild(script);
  }, []);

  return (
    <>
      {/* Option 1: Use our default trigger button */}
      <button id="userbird-trigger-${formId}">
        Feedback
      </button>

      {/* Option 2: Use your own trigger button */}
      <button onClick={() => window.UserBird?.open()}>
        Custom Feedback Button
      </button>
    </>
  );
}`}</code>
                </pre>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}