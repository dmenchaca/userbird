import { Button } from './ui/button'
import { ResponsesTable } from './responses-table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'

interface FormInstructionsProps {
  formId: string
}

export function FormInstructions({ formId }: FormInstructionsProps) {
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
              <p className="text-sm text-muted-foreground mb-4">Add this code just before the closing <code>&lt;/body&gt;</code> tag:</p>
              <div className="space-y-4">
                <div className="rounded-lg border p-4 bg-muted/50">
                  <h4 className="text-sm font-medium mb-2">Step 1: Add the trigger button</h4>
                  <p className="text-sm text-muted-foreground mb-2">Choose one of these options:</p>
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm mb-2">
                    <code>{`<!-- Option A: Use our default button -->
<button id="userbird-trigger-${formId}">Feedback</button>

<!-- Option B: Use your own custom button -->
<button onclick="UserBird.open(this)">Custom Feedback</button>`}</code>
                  </pre>
                  <p className="text-xs text-muted-foreground">Note: The button can be placed anywhere in your HTML</p>
                </div>

                <div className="rounded-lg border p-4 bg-muted/50">
                  <h4 className="text-sm font-medium mb-2">Step 2: Initialize the widget</h4>
                  <p className="text-sm text-muted-foreground mb-2">Add this initialization code:</p>
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
                    <code>{`<!-- Initialize Userbird -->
<script>
  (function(w,d,s){
    w.UserBird = w.UserBird || {};
    w.UserBird.formId = "${formId}";
    // Optional: Add user information
    w.UserBird.user = {
      id: 'user-123',      // Your user's ID
      email: 'user@example.com',  // User's email
      name: 'John Doe'     // User's name
    };
    s = d.createElement('script');
    s.src = 'https://userbird.netlify.app/widget.js';
    d.head.appendChild(s);
  })(window,document);
</script>`}</code>
                  </pre>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="react" className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">React Integration</h3>
              <p className="text-sm text-muted-foreground mb-4">Add this code to your React component:</p>
              <div className="space-y-4">
                <div className="rounded-lg border p-4 bg-muted/50">
                  <h4 className="text-sm font-medium mb-2">Complete React Example</h4>
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
                    <code>{`import { useEffect } from 'react';

function App() {
  useEffect(() => {
    // Initialize Userbird
    window.UserBird = window.UserBird || {};
    window.UserBird.formId = "${formId}";
    // Optional: Add user information
    window.UserBird.user = {
      id: 'user-123',      // Your user's ID
      email: 'user@example.com',  // User's email
      name: 'John Doe'     // User's name
    };
    
    const script = document.createElement('script');
    script.src = 'https://userbird.netlify.app/widget.js';
    document.head.appendChild(script);
  }, []);

  return (
    <>
      {/* Option A: Use our default trigger button */}
      <button id="userbird-trigger-${formId}">
        Feedback
      </button>

      {/* Option B: Use your own trigger button */}
      <button onClick={(e) => window.UserBird?.open(e.currentTarget)}>
        Custom Feedback Button
      </button>
    </>
  );
}`}</code>
                  </pre>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="script" className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Script Tag Integration</h3>
              <p className="text-sm text-muted-foreground mb-4">Add this code just before the closing <code>&lt;/body&gt;</code> tag:</p>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
                <code>{`<script>
  (function(w,d,s){
    w.UserBird = w.UserBird || {};
    w.UserBird.formId = "${formId}";
    s = d.createElement('script');
    s.src = 'https://userbird.netlify.app/widget.js';
    d.head.appendChild(s);
  })(window,document);
</script>

<!-- Option 1: Use our default trigger button -->
<button id="userbird-trigger-${formId}">Feedback</button>

<!-- Option 2: Use your own trigger button -->
<button onclick="UserBird.open(this)">Custom Feedback Button</button>`}</code>
              </pre>
            </div>
          </TabsContent>
        </Tabs>

        <div className="rounded-lg border p-4 bg-muted/50">
          <h4 className="text-sm font-medium mb-2">Important Notes</h4>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>• The widget script will automatically handle positioning relative to the trigger button</li>
            <li>• Always pass the trigger button element to UserBird.open() for proper positioning</li>
            <li>• User information is optional but recommended for better feedback tracking</li>
          </ul>
        </div>

        <Button onClick={() => window.location.reload()}>Create Another Form</Button>

        <div className="pt-8">
          <h3 className="text-lg font-semibold mb-4">Form Responses</h3>
          <ResponsesTable formId={formId} />
        </div>
      </div>
    </div>
  )
}