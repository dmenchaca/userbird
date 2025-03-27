import { Button } from '../ui/button'
import { Files, Check } from 'lucide-react'
import { CodeBlock } from '../code-block'

interface InstallInstructionsReactProps {
  formId: string
  copiedId: string | null
  handleCopy: (text: string, id: string) => void
}

export function InstallInstructionsReact({ formId, copiedId, handleCopy }: InstallInstructionsReactProps) {
  const utilCode = `// src/lib/userbird.ts
export function initUserbird(formId: string) {
  return new Promise((resolve, reject) => {
    window.UserBird = window.UserBird || {};
    window.UserBird.formId = formId;

    const script = document.createElement('script');
    script.src = 'https://userbird.netlify.app/widget.js';

    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error('Failed to load Userbird widget'));

    document.head.appendChild(script);
  });
}`;

  const componentCode = `// src/App.tsx
import { useEffect } from 'react';
import { initUserbird } from './userbird';
import { Bell } from 'lucide-react'; // Or your preferred icon

function App() {
  useEffect(() => {
    async function loadWidget() {
      try {
        await initUserbird("${formId}");
        console.log('Userbird widget loaded successfully');
      } catch (error) {
        console.error('Failed to load Userbird widget:', error);
      }
    }

    loadWidget();
  }, []);

  return (
    <>
      {/* Option A: If you use a text button */}
      <button onClick={(e) => window.UserBird?.open(e.currentTarget)}>
        Custom Feedback Button
      </button>
      
      {/* Option B: If you use an icon button (IMPORTANT: Add pointer-events-none to the icon!) */}
      <button onClick={(e) => window.UserBird?.open(e.currentTarget)}>
        <Bell className="h-6 w-6 pointer-events-none" />
      </button>
    </>
  );
}`;

  const fullInstructions = `React Integration Instructions

Step 1: Create a utility function

// userbird.ts
export function initUserbird(formId: string) {
  return new Promise((resolve, reject) => {
    window.UserBird = window.UserBird || {};
    window.UserBird.formId = formId;
    
    const script = document.createElement('script');
    script.src = 'https://userbird.netlify.app/widget.js';
    
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error('Failed to load Userbird widget'));
    
    document.head.appendChild(script);
  });
}

Step 2: Use in your component

// App.tsx
import { useEffect } from 'react';
import { initUserbird } from './userbird'
import { Bell } from 'lucide-react'; // Or your preferred icon

function App() {
  useEffect(() => {
    async function loadWidget() {
      try {
        await initUserbird("${formId}");
        console.log('Userbird widget loaded successfully');
      } catch (error) {
        console.error('Failed to load Userbird widget:', error);
      }
    }
    
    loadWidget();
  }, []);

  return (
    <>
      {/* Option A: If you use a text button */}
      <button onClick={(e) => window.UserBird?.open(e.currentTarget)}>
        Custom Feedback Button
      </button>
      
      {/* Option B: If you use an icon button (IMPORTANT: Add pointer-events-none to the icon!) */}
      <button onClick={(e) => window.UserBird?.open(e.currentTarget)}>
        <Bell className="h-6 w-6 pointer-events-none" />
      </button>
    </>
  );
}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold mb-2">React Integration</h3>
        <Button
          variant="default"
          size="sm"
          className="gap-2"
          onClick={() => handleCopy(fullInstructions, 'copy-react')}
        >
          {copiedId === 'copy-react' ? (
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
      <p className="text-sm text-muted-foreground mb-4">Add this code to your React component:</p>
      <div className="space-y-4">
        <div className="rounded-lg border p-4 bg-muted/50">
          <h4 className="text-sm font-medium mb-2">Step 1: Create a utility function</h4>
          <CodeBlock 
            id="react-util" 
            code={utilCode} 
            copiedId={copiedId} 
            onCopy={handleCopy} 
          />
        </div>

        <div className="rounded-lg border p-4 bg-muted/50">
          <h4 className="text-sm font-medium mb-2">Step 2: Use in your component</h4>
          <p className="text-sm text-muted-foreground mb-2">⚠️ IMPORTANT: Read these warnings to avoid common issues:</p>
          <ul className="text-sm text-muted-foreground mb-4 list-disc pl-4 space-y-1">
            <li>When using icon buttons, add <code className="bg-muted px-1 rounded">pointer-events-none</code> to prevent click event issues</li>
            <li>The button ID format userbird-trigger-{formId} is required for keyboard shortcuts</li>
            <li>Don't mix React initialization with direct UserBird.open() calls</li>
          </ul>
          <CodeBlock 
            id="react-component" 
            code={componentCode} 
            copiedId={copiedId} 
            onCopy={handleCopy} 
          />
        </div>
      </div>
    </div>
  );
} 