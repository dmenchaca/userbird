import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Tabs, TabsList, TabsTrigger } from './ui/tabs'
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
  const [activeTab, setActiveTab] = useState('react')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Content refs to access the transformed HTML
  const reactContentRef = useRef<HTMLDivElement>(null)
  const vueContentRef = useRef<HTMLDivElement>(null)
  const angularContentRef = useRef<HTMLDivElement>(null)
  const htmlContentRef = useRef<HTMLDivElement>(null)

  const handleCopy = async (id: string) => {
    try {
      let contentRef: HTMLDivElement | null = null
      
      switch (id) {
        case 'react':
          contentRef = reactContentRef.current
          break
        case 'vue':
          contentRef = vueContentRef.current
          break
        case 'angular':
          contentRef = angularContentRef.current
          break
        case 'html':
          contentRef = htmlContentRef.current
          break
      }
      
      if (!contentRef) {
        toast.error('Content not found')
        return
      }
      
      // Get the plain text version of the HTML content
      const textContent = contentRef.innerText
      
      // Extract framework title from the id
      const frameworkTitles = {
        'react': 'React Integration Instructions',
        'vue': 'Vue Integration Instructions',
        'angular': 'Angular Integration Instructions (Beta)',
        'html': 'HTML Integration Instructions'
      }
      
      // Create the text to copy with elements in the desired order
      const warningText = "⚠️ WARNING: Your form won't work in a local environment unless you set the URL on your form to match your local environment URL (e.g., http://localhost:3000) ⚠️\n\n"
      
      // Remove warning from copied text to prevent duplication
      let cleanedText = textContent.replace(/⚠️ WARNING[^]*?⚠️\n*/g, '')
      
      // Also remove the framework title if it appears in the text
      for (const title of Object.values(frameworkTitles)) {
        cleanedText = cleanedText.replace(new RegExp(title + '\\s*', 'g'), '')
      }
      
      await navigator.clipboard.writeText(warningText + cleanedText)
      setCopiedId(id)
      toast.success('Copied to clipboard')
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err) {
      toast.error('Failed to copy')
    }
  }

  // React content
  const reactContent = `React Integration Instructions

⚠️ WARNING: Your form won't work in a local environment unless you set the URL on your form to match your local environment URL (e.g., http://localhost:3000) ⚠️

⚠️ IMPORTANT: If your site has a Content-Security-Policy, you must allow connections to:
- https://userbird.netlify.app (for loading the widget and API calls)

Add this domain to your CSP connect-src directive, for example:
connect-src 'self' https://userbird.netlify.app

Userbird lets your users send feedback, report bugs, and submit feature requests directly from your app.


Step 1: Create a utility function
\`\`\`typescript
// userbird.ts
export function initUserbird(formId: string) {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('Window not available'));
    
    window.UserBird = window.UserBird || {};
    window.UserBird.formId = formId;
    
    // Log URL to help debug domain mismatches
    console.log('[Userbird] Initializing on domain:', window.location.origin);
    
    const script = document.createElement('script');
    script.src = 'https://userbird.netlify.app/widget.js';
    
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error('Failed to load Userbird widget'));
    
    document.head.appendChild(script);
  });
}

// Add TypeScript declaration for window.UserBird
declare global {
  interface Window {
    UserBird: {
      formId: string;
      open?: (trigger?: HTMLElement) => void;
      user?: {
        id?: string;
        email?: string;
        name?: string;
      };
    };
  }
}
\`\`\`

Step 2: Use in your component

⚠️IMPORTANT (4)⚠️<br>
 1. The widget must be fully initialized before setting up click handlers.
<br> 
 2. The widget automatically handles click events for buttons with the correct ID format. DO NOT SET UP YOUR OWN CLICK HANDLERS.
<br>  
 3. Create your own custom button in your UI to trigger the widget. Decide whether to use a text button or an icon button.
<br>
 4. ⚠️ CRITICAL: Add the "pointer-events-none" class to ALL elements inside your button, including icons, spans, and text. If ANY element inside the button doesn't have this class, clicks on that element won't trigger the widget!

\`\`\`tsx
// App.tsx
import { useEffect } from 'react';
import { initUserbird } from './userbird';
import { Bell } from 'lucide-react'; // Or your preferred icon

function App() {
  useEffect(() => {
    async function loadWidget() {
      try {
        // First set up the UserBird object and user information
        // IMPORTANT: Set user info BEFORE initializing the widget
        window.UserBird = window.UserBird || {};
        window.UserBird.user = {
          id: 'user-123',                 // Your user's unique ID
          email: 'user@example.com',      // User's email for follow-ups
          name: 'John Doe',               // User's name
        };
        
        // Then initialize the widget
        await initUserbird("${formId}");
        
        console.log('Userbird widget loaded successfully');
      } catch (error) {
        console.error('Failed to load Userbird widget:', error);
      }
    }

    if (typeof window !== 'undefined') {
      loadWidget();
    }
  }, []);

  return (
    <>
      {/* Option A: If you use a text button */}
      <button id="userbird-trigger-${formId}">
        <span className="pointer-events-none">Custom Feedback Button</span>
      </button>
      
      {/* Option B: If you use a button with icon and text */}
      <button id="userbird-trigger-${formId}" className="flex items-center gap-2">
        <Bell className="h-6 w-6 pointer-events-none" />
        <span className="pointer-events-none">Feedback</span>
      </button>
    </>
  );
}
\`\`\`

Step 3: Verify it's working

When implemented correctly:
1. Your button should be visible on your page
2. Clicking the button will open the Userbird feedback form as a modal dialog
3. The form will allow users to submit feedback directly to your dashboard

Common issues:
• Missing pointer-events-none: Ensure ALL elements inside your button (icons, spans, text) have the pointer-events-none class
• URL mismatch: When testing locally, make sure your form's allowed domain matches your test URL (e.g., http://localhost:3000)
• If the button doesn't work: Check that you've added pointer-events-none to every child element in the button
• If the form doesn't open: Check the console for any loading errors
• If formId error: Verify you're using the exact formId: \`${formId}\`
• Button ID: The ID format \`userbird-trigger-${formId}\` is required for keyboard shortcuts to position correctly
• Click handler not working: Do not set up your own click handlers - the widget handles clicks automatically for buttons with the correct ID format
• User info timing: Make sure to set user information BEFORE initializing the widget
• CSP error: If you see "Refused to connect" errors, check that your Content-Security-Policy includes 'userbird.netlify.app' in the connect-src directive

Key features:
• window.UserBird.open() - Opens the feedback form
• window.UserBird.formId - Connects feedback to your specific form
• window.UserBird.user - Optionally add user context (id, email, name)
`;

  // Vue content
  const vueContent = `Vue Integration Instructions

⚠️ WARNING: Your form won't work in a local environment unless you set the URL on your form to match your local environment URL (e.g., http://localhost:3000) ⚠️

⚠️ IMPORTANT: If your site has a Content-Security-Policy, you must allow connections to:
- https://userbird.netlify.app (for loading the widget and API calls)

Add this domain to your CSP connect-src directive, for example:
connect-src 'self' https://userbird.netlify.app

Userbird lets your users send feedback, report bugs, and submit feature requests directly from your app.


Step 1: Create a composable function
\`\`\`typescript
// userbird.ts
export function useUserbird(formId: string) {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('Window not available'));
    
    window.UserBird = window.UserBird || {};
    window.UserBird.formId = formId;
    
    // Log URL to help debug domain mismatches
    console.log('[Userbird] Initializing on domain:', window.location.origin);
    
    const script = document.createElement('script');
    script.src = 'https://userbird.netlify.app/widget.js';
    
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error('Failed to load Userbird widget'));
    
    document.head.appendChild(script);
  });
}

// Add TypeScript declaration for window.UserBird
declare global {
  interface Window {
    UserBird: {
      formId: string;
      open?: (trigger?: HTMLElement) => void;
      user?: {
        id?: string;
        email?: string;
        name?: string;
      };
    };
  }
}
\`\`\`

Step 2: Use in your component

⚠️IMPORTANT (4)⚠️<br>
 1. The widget must be fully initialized before setting up click handlers.
<br> 
 2. The widget automatically handles click events for buttons with the correct ID format. DO NOT SET UP YOUR OWN CLICK HANDLERS.
<br>
 3. Create your own custom button in your UI to trigger the widget. Decide whether to use a text button or an icon button.
<br>
 4. ⚠️ CRITICAL: Add the "pointer-events-none" class to ALL elements inside your button, including icons, spans, and text. If ANY element inside the button doesn't have this class, clicks on that element won't trigger the widget!

\`\`\`vue
<!-- App.vue -->
<script setup lang="ts">
import { onMounted } from 'vue'
import { useUserbird } from './userbird'

onMounted(async () => {
  try {
    // First set up the UserBird object and user information
    // IMPORTANT: Set user info BEFORE initializing the widget
    window.UserBird = window.UserBird || {};
    window.UserBird.user = {
      id: 'user-123',                 // Your user's unique ID
      email: 'user@example.com',      // User's email for follow-ups
      name: 'John Doe',               // User's name
    };
    
    // Then initialize the widget
    await useUserbird("${formId}");
    
    console.log('Userbird widget loaded successfully');
  } catch (error) {
    console.error('Failed to load Userbird widget:', error);
  }
})
</script>

<template>
  <!-- Option A: If you use a text button -->
  <button id="userbird-trigger-${formId}">
    <span class="pointer-events-none">Custom Feedback Button</span>
  </button>
  
  <!-- Option B: If you use a button with icon and text -->
  <button id="userbird-trigger-${formId}" class="flex items-center gap-2">
    <svg class="h-6 w-6 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
    <span class="pointer-events-none">Feedback</span>
  </button>
</template>
\`\`\`

Step 3: Verify it's working

When implemented correctly:
1. Your button should be visible on your page
2. Clicking the button will open the Userbird feedback form as a modal dialog
3. The form will allow users to submit feedback directly to your dashboard

Common issues:
• Missing pointer-events-none: Ensure ALL elements inside your button (icons, spans, text) have the pointer-events-none class
• URL mismatch: When testing locally, make sure your form's allowed domain matches your test URL (e.g., http://localhost:3000)
• If the button doesn't work: Check that you've added pointer-events-none to every child element in the button
• If the form doesn't open: Check the console for any loading errors
• If formId error: Verify you're using the exact formId: \`${formId}\`
• Button ID: The ID format \`userbird-trigger-${formId}\` is required for keyboard shortcuts to position correctly
• Click handler not working: Do not set up your own click handlers - the widget handles clicks automatically for buttons with the correct ID format
• User info timing: Make sure to set user information BEFORE initializing the widget
• CSP error: If you see "Refused to connect" errors, check that your Content-Security-Policy includes 'userbird.netlify.app' in the connect-src directive

Key features:
• window.UserBird.open() - Opens the feedback form
• window.UserBird.formId - Connects feedback to your specific form
• window.UserBird.user - Optionally add user context (id, email, name)
`;

  // Angular content
  const angularContent = `Angular Integration Instructions (Beta)

⚠️ WARNING: Your form won't work in a local environment unless you set the URL on your form to match your local environment URL (e.g., http://localhost:3000) ⚠️

⚠️ IMPORTANT: If your site has a Content-Security-Policy, you must allow connections to:
- https://userbird.netlify.app (for loading the widget and API calls)

Add this domain to your CSP connect-src directive, for example:
connect-src 'self' https://userbird.netlify.app

Userbird lets your users send feedback, report bugs, and submit feature requests directly from your app.


Step 1: Create a service
\`\`\`typescript
// userbird.service.ts
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class UserbirdService {
  private loaded = false;

  initUserbird(formId: string): Promise<boolean> {
    if (this.loaded) return Promise.resolve(true);

    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') return reject(new Error('Window not available'));
      
      window.UserBird = window.UserBird || {};
      window.UserBird.formId = formId;
      
      // Log URL to help debug domain mismatches
      console.log('[Userbird] Initializing on domain:', window.location.origin);
      
      const script = document.createElement('script');
      script.src = 'https://userbird.netlify.app/widget.js';
      
      script.onload = () => {
        this.loaded = true;
        resolve(true);
      };
      script.onerror = () => reject(new Error('Failed to load Userbird widget'));
      
      document.head.appendChild(script);
    });
  }
}

// Add TypeScript declaration for window.UserBird
declare global {
  interface Window {
    UserBird: {
      formId: string;
      open?: (trigger?: HTMLElement) => void;
      user?: {
        id?: string;
        email?: string;
        name?: string;
      };
    };
  }
}
\`\`\`

Step 2: Use in your component

⚠️IMPORTANT (4)⚠️<br>
 1. The widget must be fully initialized before setting up click handlers.
<br> 
 2. The widget automatically handles click events for buttons with the correct ID format. DO NOT SET UP YOUR OWN CLICK HANDLERS.
<br>
 3. Create your own custom button in your UI to trigger the widget. Decide whether to use a text button or an icon button.
<br>
 4. ⚠️ CRITICAL: Add the "pointer-events-none" class to ALL elements inside your button, including icons, spans, and text. If ANY element inside the button doesn't have this class, clicks on that element won't trigger the widget!

\`\`\`typescript
// app.component.ts
import { Component, OnInit } from '@angular/core';
import { UserbirdService } from './userbird.service';

@Component({
  selector: 'app-root',
  template: '<!-- Option A: If you use a text button -->' + 
    '<button id="userbird-trigger-${formId}">' +
    '  <span class="pointer-events-none">Custom Feedback Button</span>' +
    '</button>' +
    '<!-- Option B: If you use a button with icon and text -->' +
    '<button id="userbird-trigger-${formId}" class="flex items-center gap-2">' +
    '  <svg class="h-6 w-6 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">' +
    '    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" ' +
    '          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />' +
    '  </svg>' +
    '  <span class="pointer-events-none">Feedback</span>' +
    '</button>'
})
export class AppComponent implements OnInit {
  constructor(private userbird: UserbirdService) {}

  async ngOnInit() {
    try {
      // First set up the UserBird object and user information
      // IMPORTANT: Set user info BEFORE initializing the widget
      window.UserBird = window.UserBird || {};
      window.UserBird.user = {
        id: 'user-123',                 // Your user's unique ID
        email: 'user@example.com',      // User's email for follow-ups
        name: 'John Doe',               // User's name
      };
      
      // Then initialize the widget
      await this.userbird.initUserbird("${formId}");
      
      console.log('Userbird widget loaded successfully');
    } catch (error) {
      console.error('Failed to load Userbird widget:', error);
    }
  }
}
\`\`\`

Step 3: Verify it's working

When implemented correctly:
1. Your button should be visible on your page
2. Clicking the button will open the Userbird feedback form as a modal dialog
3. The form will allow users to submit feedback directly to your dashboard

Common issues:
• Missing pointer-events-none: Ensure ALL elements inside your button (icons, spans, text) have the pointer-events-none class
• URL mismatch: When testing locally, make sure your form's allowed domain matches your test URL (e.g., http://localhost:3000)
• If the button doesn't work: Check that you've added pointer-events-none to every child element in the button
• If the form doesn't open: Check the console for any loading errors
• If formId error: Verify you're using the exact formId: \`${formId}\`
• Button ID: The ID format \`userbird-trigger-${formId}\` is required for keyboard shortcuts to position correctly
• Click handler not working: Do not set up your own click handlers - the widget handles clicks automatically for buttons with the correct ID format
• User info timing: Make sure to set user information BEFORE initializing the widget
• CSP error: If you see "Refused to connect" errors, check that your Content-Security-Policy includes 'userbird.netlify.app' in the connect-src directive
• Service injection: Make sure UserbirdService is properly provided in your module

Key features:
• window.UserBird.open() - Opens the feedback form
• window.UserBird.formId - Connects feedback to your specific form
• window.UserBird.user - Optionally add user context (id, email, name)
• UserbirdService.initUserbird() - Prevents duplicate script loading
`;

  // HTML content
  const htmlContent = `HTML Integration Instructions

⚠️ WARNING: Your form won't work in a local environment unless you set the URL on your form to match your local environment URL (e.g., http://localhost:3000) ⚠️

⚠️ IMPORTANT: If your site has a Content-Security-Policy, you must allow connections to:
- https://userbird.netlify.app (for loading the widget and API calls)

Add this domain to your CSP connect-src directive, for example:
connect-src 'self' https://userbird.netlify.app

Userbird lets your users send feedback, report bugs, and submit feature requests directly from your app.


Step 1: Add the trigger button

⚠️IMPORTANT (4)⚠️<br>
 1. The widget must be fully initialized before setting up click handlers.
<br> 
 2. The widget automatically handles click events for buttons with the correct ID format. DO NOT SET UP YOUR OWN CLICK HANDLERS.
<br>
 3. Create your own custom button in your UI to trigger the widget. Decide whether to use a text button or an icon button.
<br>
 4. ⚠️ CRITICAL: Add the "pointer-events-none" class to ALL elements inside your button, including icons, spans, and text. If ANY element inside the button doesn't have this class, clicks on that element won't trigger the widget!

\`\`\`html
<!-- Option A: If you use a text button -->
<button id="userbird-trigger-${formId}">
  <span class="pointer-events-none">Custom Feedback</span>
</button>

<!-- Option B: If you use a button with icon and text -->
<button id="userbird-trigger-${formId}" class="flex items-center gap-2">
  <svg class="h-6 w-6 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
  <span class="pointer-events-none">Feedback</span>
</button>
\`\`\`

Step 2: Initialize the widget
\`\`\`html
<!-- Initialize Userbird - Place this before the closing </body> tag -->
<script>
  (function(w,d,s){
    // First set up the UserBird object and user information
    // IMPORTANT: Set user info BEFORE loading the script
    w.UserBird = w.UserBird || {};
    w.UserBird.formId = "${formId}";
    
    // Optional: Add user information
    w.UserBird.user = {
      id: 'user-123',                 // Your user's ID
      email: 'user@example.com',      // User's email
      name: 'John Doe',               // User's name
    };
    
    // Log URL to help debug domain mismatches
    console.log('[Userbird] Initializing on domain:', w.location.origin);
    
    // Then load the script
    s = d.createElement('script');
    s.src = 'https://userbird.netlify.app/widget.js';
    s.onload = function() {
      console.log('Userbird widget loaded successfully');
    };
    s.onerror = function() {
      console.error('Failed to load Userbird widget');
    };
    d.head.appendChild(s);
  })(window,document);
</script>
\`\`\`

Step 3: Verify it's working

When implemented correctly:
1. Your button should be visible on your page
2. Clicking the button will open the Userbird feedback form as a modal dialog
3. The form will allow users to submit feedback directly to your dashboard

Common issues:
• Missing pointer-events-none: Ensure ALL elements inside your button (icons, spans, text) have the pointer-events-none class
• URL mismatch: When testing locally, make sure your form's allowed domain matches your test URL (e.g., http://localhost:3000)
• Script placement: Make sure the initialization script is before the closing </body> tag
• If the button doesn't work: Check that you've added pointer-events-none to every child element in the button
• Button placement: The button should be placed after the Userbird script has initialized
• Order matters: Initialize the widget before using UserBird.open()
• If formId error: Verify you're using the exact formId: \`${formId}\`
• Button ID: The ID format \`userbird-trigger-${formId}\` is required for keyboard shortcuts to position correctly
• Click handler not working: Do not set up your own click handlers - the widget handles clicks automatically for buttons with the correct ID format
• User info timing: Make sure to set user information BEFORE loading the script
• CSP error: If you see "Refused to connect" errors, check that your Content-Security-Policy includes 'userbird.netlify.app' in the connect-src directive

Key features:
• UserBird.open(buttonElement) - Opens the feedback form 
• UserBird.formId - Connects feedback to your specific form
• UserBird.user - Optionally add user context (id, email, name)
• You can also add a default trigger with id="userbird-trigger-\`${formId}\`"
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

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="react">React</TabsTrigger>
            <TabsTrigger value="vue">Vue</TabsTrigger>
            <TabsTrigger value="angular">Angular</TabsTrigger>
            <TabsTrigger value="html">HTML</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="h-[70vh] overflow-y-auto p-5 user-select-text border border-neutral-200 rounded-md bg-white">
          {activeTab === 'react' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">React Integration</h3>
                <Button size="sm" onClick={() => handleCopy('react')}>
                  {copiedId === 'react' ? <Check size={16} /> : <Copy size={16} />}
                  <span className="ml-2">Copy prompt</span>
                </Button>
              </div>
              <div 
                ref={reactContentRef}
                dangerouslySetInnerHTML={{ __html: formatInstructionContent(reactContent) }} 
              />
            </div>
          )}

          {activeTab === 'vue' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Vue Integration</h3>
                <Button size="sm" onClick={() => handleCopy('vue')}>
                  {copiedId === 'vue' ? <Check size={16} /> : <Copy size={16} />}
                  <span className="ml-2">Copy prompt</span>
                </Button>
              </div>
              <div 
                ref={vueContentRef}
                dangerouslySetInnerHTML={{ __html: formatInstructionContent(vueContent) }} 
              />
            </div>
          )}

          {activeTab === 'angular' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Angular Integration (Beta)</h3>
                <Button size="sm" onClick={() => handleCopy('angular')}>
                  {copiedId === 'angular' ? <Check size={16} /> : <Copy size={16} />}
                  <span className="ml-2">Copy prompt</span>
                </Button>
              </div>
              <div 
                ref={angularContentRef}
                dangerouslySetInnerHTML={{ __html: formatInstructionContent(angularContent) }} 
              />
            </div>
          )}

          {activeTab === 'html' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">HTML Integration</h3>
                <Button size="sm" onClick={() => handleCopy('html')}>
                  {copiedId === 'html' ? <Check size={16} /> : <Copy size={16} />}
                  <span className="ml-2">Copy prompt</span>
                </Button>
              </div>
              <div 
                ref={htmlContentRef}
                dangerouslySetInnerHTML={{ __html: formatInstructionContent(htmlContent) }} 
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}