import { Button } from './ui/button'
import { FeedbackInbox } from './feedback-inbox'
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
<button id="usermonk-trigger-${formId}">Feedback</button>

<!-- Option B: Use your own custom button -->
<button onclick="UserMonk.open(this)">Custom Feedback</button>`}</code>
                  </pre>
                  <p className="text-xs text-muted-foreground">Note: The button can be placed anywhere in your HTML</p>
                </div>

                <div className="rounded-lg border p-4 bg-muted/50">
                  <h4 className="text-sm font-medium mb-2">Step 2: Initialize the widget</h4>
                  <p className="text-sm text-muted-foreground mb-2">Add this initialization code:</p>
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
                    <code>{`<!-- Initialize Usermonk -->
<script>
  (function(w,d,s) {
    // Initialize Usermonk widget
    w.UserMonk = w.UserMonk || {};
    w.UserMonk.formId = "${formId}";
    
    // Optional: Add user information
    w.UserMonk.user = {
      id: 'user-123',                 // Your user's ID
      email: 'user@example.com',      // User's email
      name: 'John Doe'                // User's name
    };
    
    // Load the widget script
    s = d.createElement('script');
    s.src = 'https://usermonk.netlify.app/widget.js';
    s.onload = function() {
      console.log('Usermonk widget loaded successfully');
    };
    s.onerror = function(error) {
      console.error('Failed to load Usermonk widget');
    };
    d.head.appendChild(s);
  })(window, document);
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
                  <h4 className="text-sm font-medium mb-2">Step 1: Create a utility function</h4>
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
                    <code>{`// usermonk.ts
export function initUsermonk(formId: string, userData?: { 
  id?: string; 
  email?: string; 
  name?: string;
}) {
  return new Promise((resolve, reject) => {
    window.UserMonk = window.UserMonk || {};
    window.UserMonk.formId = formId;
    
    // Set user data if provided
    if (userData) {
      window.UserMonk.user = {
        id: userData.id,
        email: userData.email,
        name: userData.name
      };
    }
    
    const script = document.createElement('script');
    script.src = 'https://usermonk.netlify.app/widget.js';
    
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error('Failed to load Usermonk widget'));
    
    document.head.appendChild(script);
  });
}`}</code>
                  </pre>
                </div>

                <div className="rounded-lg border p-4 bg-muted/50">
                  <h4 className="text-sm font-medium mb-2">Step 2: Use in your component</h4>
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
                    <code>{`import { useEffect } from 'react';
import { initUsermonk } from './usermonk';

function App() {
  useEffect(() => {
    async function loadWidget() {
      try {
        // Initialize with form ID and optional user data
        await initUsermonk("${formId}", {
          id: 'user-123',             // Your user's ID (optional)
          email: 'user@example.com',  // User's email (optional)
          name: 'John Doe'            // User's name (optional)
        });
        console.log('Usermonk widget loaded successfully');
      } catch (error) {
        console.error('Failed to load Usermonk widget:', error);
      }
    }
    
    loadWidget();
  }, []);

  return (
    <>
      {/* Option A: Use our default trigger button */}
      <button id="usermonk-trigger-${formId}">
        Feedback
      </button>

      {/* Option B: Use your own trigger button */}
      <button onClick={(e) => window.UserMonk?.open(e.currentTarget)}>
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
        </Tabs>

        <div className="rounded-lg border p-4 bg-muted/50">
          <h4 className="text-sm font-medium mb-2">Important Notes</h4>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>• The widget script will automatically handle positioning relative to the trigger button</li>
            <li>• Always pass the trigger button element to UserMonk.open() for proper positioning</li>
            <li>• User information is optional but recommended for better feedback tracking</li>
            <li>• The widget initializes consistently across all pages with the same configuration</li>
          </ul>
        </div>

        <Button onClick={() => window.location.reload()}>Create Another Form</Button>

        <div className="pt-8">
          <h3 className="text-lg font-semibold mb-4">Form Responses</h3>
          <FeedbackInbox formId={formId} />
        </div>
      </div>
    </div>
  )
}