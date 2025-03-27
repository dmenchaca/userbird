import { Button } from '../ui/button'
import { Files, Check, Copy } from 'lucide-react'
import { CodeBlock } from '../code-block'

interface InstallInstructionsHTMLProps {
  formId: string
  copiedId: string | null
  handleCopy: (text: string, id: string) => void
}

export function InstallInstructionsHTML({ formId, copiedId, handleCopy }: InstallInstructionsHTMLProps) {
  const buttonCode = `<!-- Option A: If you use a text button -->
<button onclick="UserBird.open(this)">Custom Feedback</button>

<!-- Option B: If you use an icon button (IMPORTANT: Add pointer-events-none to the icon!) -->
<button onclick="UserBird.open(this)">
  <svg class="h-6 w-6 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
</button>`;

  const initCode = `<!-- Initialize Userbird -->
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
</script>`;

  const fullInstructions = `HTML Integration Instructions

Step 1: Add the trigger button

${buttonCode}

Step 2: Initialize the widget

${initCode}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-medium">HTML Integration</h3>
        <Button
          variant="default"
          size="sm"
          className="gap-2"
          onClick={() => handleCopy(fullInstructions, 'copy-html')}
        >
          {copiedId === 'copy-html' ? (
            <>
              <Check className="h-4 w-4" />
              Copied!
            </>
          ) : (
            <>
              <Files className="h-4 w-4" />
              Copy All
            </>
          )}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mb-4">Add this code just before the closing <code>&lt;/body&gt;</code> tag:</p>
      <div className="space-y-4">
        <div className="rounded-lg border p-4 bg-muted/50">
          <h4 className="text-sm font-medium mb-2">Step 1: Add the trigger button</h4>
          <p className="text-sm text-muted-foreground mb-2">We recommend using your own custom button for better integration with your UI (‼️Recommended‼️):</p>
          <div className="bg-muted p-4 rounded-lg overflow-x-auto text-sm mb-2 relative">
            <pre><code>{buttonCode}</code></pre>
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-3 right-3 h-6 w-6"
              onClick={() => handleCopy(buttonCode, 'html-button')}
            >
              {copiedId === 'html-button' ? (
                <Check className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Notes:
            <ul className="list-disc pl-4 mt-1 space-y-1">
              <li>The button can be placed anywhere in your HTML</li>
              <li>When using icons, add <code className="bg-muted px-1 rounded">pointer-events-none</code> to prevent click event issues</li>
            </ul>
          </p>
        </div>

        <div className="rounded-lg border p-4 bg-muted/50">
          <h4 className="text-sm font-medium mb-2">Step 2: Initialize the widget</h4>
          <p className="text-sm text-muted-foreground mb-2">Add this initialization code:</p>
          <CodeBlock
            id="html-init"
            code={initCode}
            copiedId={copiedId}
            onCopy={handleCopy}
          />
        </div>
      </div>
    </div>
  );
} 