import { Button } from './ui/button'
import { FeedbackTable } from './feedback-table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'

interface FormInstructionsProps {
  formId: string
  buttonColor: string
}

export function FormInstructions({ formId, buttonColor }: FormInstructionsProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Installation Instructions</h2>
      <div className="space-y-4">
        <p className="text-muted-foreground">
          Choose your preferred integration method:
        </p>

        <Tabs defaultValue="html" className="w-full">
          <TabsList>
            <TabsTrigger value="html">HTML</TabsTrigger>
            <TabsTrigger value="react">React</TabsTrigger>
            <TabsTrigger value="script">Script Tag</TabsTrigger>
          </TabsList>

          <TabsContent value="html" className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">HTML Integration</h3>
              <p className="text-sm text-muted-foreground mb-4">Add this button anywhere in your HTML:</p>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
                <code>{`<button id="userbird-trigger-${formId}">Feedback</button>`}</code>
              </pre>
            </div>
          </TabsContent>

          <TabsContent value="react" className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">React Integration</h3>
              <p className="text-sm text-muted-foreground mb-4">Initialize the widget in your React component:</p>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
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
    <button id="userbird-trigger-${formId}">
      Feedback
    </button>
  );
}`}</code>
              </pre>
            </div>
          </TabsContent>

          <TabsContent value="script" className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Script Tag Integration</h3>
              <p className="text-sm text-muted-foreground mb-4">Add this code just before the closing <code>&lt;/body&gt;</code> tag:</p>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
                <code>{`<script>
  (function(w,d,i,s){
    w.UserBird=w.UserBird||function(){};
    w.UserBird.formId="${formId}";
    w.UserBird.buttonColor="${buttonColor}";
    s=d.createElement('script');
    s.src='https://userbird.netlify.app/widget.js';
    d.head.appendChild(s);
  })(window,document);
</script>`}</code>
              </pre>
            </div>
          </TabsContent>
        </Tabs>

        <div className="rounded-lg border p-4 bg-muted/50">
          <h4 className="text-sm font-medium mb-2">Note</h4>
          <p className="text-sm text-muted-foreground">
            The feedback form will automatically position itself relative to the trigger button,
            adjusting its placement based on available space in the viewport.
          </p>
        </div>

        <Button onClick={() => window.location.reload()}>Create Another Form</Button>

        <div className="pt-8">
          <h3 className="text-lg font-semibold mb-4">Feedback Submissions</h3>
          <FeedbackTable formId={formId} />
        </div>
      </div>
    </div>
  )
}