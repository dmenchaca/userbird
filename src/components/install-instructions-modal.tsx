import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { Copy, Check } from 'lucide-react'
import { useState, useRef } from 'react'
import { toast } from 'sonner'

interface InstallInstructionsModalProps {
  formId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InstallInstructionsModal({ formId, open, onOpenChange }: InstallInstructionsModalProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Content ref to access the transformed HTML
  const htmlContentRef = useRef<HTMLDivElement>(null)

  const handleCopy = async () => {
    try {
      const contentRef = htmlContentRef.current
      
      if (!contentRef) {
        toast.error('Content not found')
        return
      }
      
      // Get the plain text version of the HTML content
      const textContent = contentRef.innerText
            
      // Create the text to copy with elements in the desired order
      const warningText = "⚠️ WARNING: Your form won't work in a local environment unless you set the URL on your form to match your local environment URL (e.g., http://localhost:3000) ⚠️\n\n"
      
      // Remove warning from copied text to prevent duplication
      let cleanedText = textContent.replace(/⚠️ WARNING[^]*?⚠️\n*/g, '')
      
      // Also remove the framework title if it appears in the text
      cleanedText = cleanedText.replace(/HTML Integration Instructions\s*/g, '')
      
      await navigator.clipboard.writeText(warningText + cleanedText)
      setCopiedId('html')
      toast.success('Copied to clipboard')
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err) {
      toast.error('Failed to copy')
    }
  }

  // HTML content
  const htmlContent = `HTML Integration Instructions

⚠️ WARNING: Your form won't work in a local environment unless you set the URL on your form to match your local environment URL (e.g., http://localhost:3000) ⚠️

⚠️ IMPORTANT: If your site has a Content-Security-Policy, you must allow connections to:
- https://userbird.netlify.app (for loading the widget and API calls)

Add this domain to your CSP connect-src directive, for example:
connect-src 'self' https://userbird.netlify.app

Userbird lets your users send feedback, report bugs, and submit feature requests directly from your app.


Step 1: Add the trigger button

\`\`\`html
<!-- Option A: Simple text button -->
<button id="userbird-trigger-${formId}">Feedback</button>

<!-- Option B: Button with icon and text -->
<button id="userbird-trigger-${formId}" class="flex items-center gap-2">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
  </svg>
  <span>Feedback</span>
  <span class="badge">F</span>
</button>
\`\`\`

Step 2: Initialize the widget
\`\`\`html
<!-- Initialize Userbird - Place this before the closing </body> tag -->
<script>
  (function(w,d,s) {
    // Initialize Userbird widget
    w.UserBird = w.UserBird || {};
    w.UserBird.formId = "${formId}";
    
    // Optional: Add user information
    w.UserBird.user = {
      id: 'user-123',                 // Your user's ID
      email: 'user@example.com',      // User's email
      name: 'John Doe'                // User's name
    };
    
    // Load the widget script
    s = d.createElement('script');
    s.src = 'https://userbird.netlify.app/widget.js';
    s.onload = function() {
      console.log('Userbird widget loaded successfully');
    };
    s.onerror = function(error) {
      console.error('Failed to load Userbird widget');
    };
    d.head.appendChild(s);
  })(window, document);
</script>
\`\`\`

Step 3: Open the widget programmatically (optional)

You can also open the widget programmatically from anywhere in your code:

\`\`\`html
<button onclick="UserBird.open(this)">Open Feedback Form</button>
\`\`\`

Or using JavaScript:

\`\`\`javascript
document.getElementById('my-custom-button').addEventListener('click', function() {
  UserBird.open(this);
});
\`\`\`

Step 4: Verify it's working

When implemented correctly:
1. Your button should be visible on your page
2. Clicking the button will open the Userbird feedback form as a modal dialog
3. The form will allow users to submit feedback directly to your dashboard

Common issues:
• URL mismatch: When testing locally, make sure your form's allowed domain matches your test URL (e.g., http://localhost:3000)
• Script placement: Make sure the initialization script is before the closing </body> tag
• Button ID: The ID format \`userbird-trigger-${formId}\` is required for the keyboard shortcut to work correctly
• Order matters: Initialize the widget before using UserBird.open()
• If formId error: Verify you're using the exact formId: \`${formId}\`
• CSP error: If you see "Refused to connect" errors, check that your Content-Security-Policy includes 'userbird.netlify.app' in the connect-src directive

Key features:
• UserBird.open() - Opens the feedback form from anywhere in your code
• UserBird.formId - Connects feedback to your specific form
• UserBird.user - Add user context (id, email, name) for better feedback tracking
• Keyboard shortcut: Press 'F' to open the form when a button with id="userbird-trigger-\`${formId}\`" exists
`;

  // Function to format content consistently using a simpler approach with divs
  const formatInstructionContent = (content: string) => {
    // Extract the intro paragraph and warning
    const warningMatch = content.match(/⚠️ WARNING[^]*?⚠️/);
    const userBirdIntro = content.match(/Userbird lets your users send[^]*?app\./);
    
    let formattedWarning = '';
    let formattedIntro = '';
    let remainingContent = content;
    
    // Format the warning in red
    if (warningMatch) {
      formattedWarning = `<p class="mb-4 text-red-600 font-bold">${warningMatch[0]}</p>`;
      remainingContent = remainingContent.replace(warningMatch[0], '');
    }
    
    // Format the userbird intro
    if (userBirdIntro) {
      formattedIntro = `<p class="mb-4">${userBirdIntro[0]}</p>`;
      remainingContent = remainingContent.replace(userBirdIntro[0], '');
    }
    
    // Remove the framework title line if present
    remainingContent = remainingContent.replace(/^[A-Za-z]+ Integration Instructions(?:\s*\(Beta\))?\s*\n+/g, '');
    
    // First, replace code blocks with escaped HTML 
    let processedContent = remainingContent.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
      const language = lang || '';
      // Escape HTML characters to display raw code
      const escapedCode = code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
      
      return `<div class="code-block"><pre style="font-family: monospace; background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto; margin: 16px 0; line-height: 1.4; font-size: 0.9rem;"><code class="language-${language}">${escapedCode}</code></pre></div>`;
    });
    
    // Then process inline code blocks (text wrapped in backticks)
    processedContent = processedContent.replace(/`([^`]+)`/g, 
      '<span style="font-family: monospace; background: #f5f5f5; padding: 2px 4px; border-radius: 3px; font-size: 0.9rem;">$1</span>');

    // Split into sections and process each part separately
    let parts = processedContent.split(/^(Step \d+:.+|When implemented correctly:|Common issues:|Key features:)$/gm);
    
    // Start with warning, then title (omitted), then intro
    let result = formattedWarning + formattedIntro;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();
      
      if (!part) continue;
      
      if (part.startsWith('Step')) {
        // Format step headers
        result += `<h2 class="text-lg font-semibold mt-6 mb-3">${part}</h2>`;
      } 
      else if (part.startsWith('When implemented correctly:')) {
        // Format verification section
        result += `<h3 class="text-base font-medium mt-5 mb-2">${part}</h3>`;
        
        // Find numbered list items
        const nextPart = parts[i + 1] || '';
        const listItems = nextPart.match(/^\d+\.\s.+$/gm);
        
        if (listItems && listItems.length > 0) {
          // Format as ordered list
          result += '<ol class="list-decimal ml-6 mb-4">';
          listItems.forEach(item => {
            result += `<li>${item.replace(/^\d+\.\s/, '')}</li>`;
          });
          result += '</ol>';
          
          // Skip the next part since we've processed it
          i++;
        }
      }
      else if (part.startsWith('Common issues:') || part.startsWith('Key features:')) {
        // Format lists sections
        result += `<h3 class="text-base font-medium mt-5 mb-2">${part}</h3>`;
        
        // Find bullet list items
        const nextPart = parts[i + 1] || '';
        const listItems = nextPart.match(/^•\s.+$/gm);
        
        if (listItems && listItems.length > 0) {
          // Format as unordered list
          result += '<ul class="list-disc ml-6 mb-4">';
          listItems.forEach(item => {
            result += `<li>${item.replace(/^•\s/, '')}</li>`;
          });
          result += '</ul>';
          
          // Skip the next part since we've processed it
          i++;
        }
      }
      else {
        // Format any other content that doesn't match special patterns
        const hasBullets = part.match(/^•\s.+$/gm);
        const hasNumbers = part.match(/^\d+\.\s.+$/gm);
        
        if (hasBullets) {
          result += '<ul class="list-disc ml-6 mb-4">';
          hasBullets.forEach(item => {
            result += `<li>${item.replace(/^•\s/, '')}</li>`;
          });
          result += '</ul>';
        } 
        else if (hasNumbers) {
          result += '<ol class="list-decimal ml-6 mb-4">';
          hasNumbers.forEach(item => {
            result += `<li>${item.replace(/^\d+\.\s/, '')}</li>`;
          });
          result += '</ol>';
        } 
        else if (part) {
          result += `<p class="mb-3">${part}</p>`;
        }
      }
    }
    
    // Wrap the content in appropriate div
    return `<div class="instruction-content">${result}</div>`;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[45rem]">
        <DialogHeader>
          <DialogTitle>Installation Instructions</DialogTitle>
        </DialogHeader>

        <div className="h-[70vh] overflow-y-auto p-5 user-select-text border border-neutral-200 rounded-md bg-white">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">HTML/JavaScript Integration</h3>
              <Button size="sm" onClick={handleCopy}>
                {copiedId === 'html' ? <Check size={16} /> : <Copy size={16} />}
                <span className="ml-2">Copy instructions</span>
              </Button>
            </div>
            <div 
              ref={htmlContentRef}
              dangerouslySetInnerHTML={{ __html: formatInstructionContent(htmlContent) }} 
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}