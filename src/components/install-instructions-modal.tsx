import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Button } from './ui/button'
import { Copy, Check, Files } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

type FrameworkType = 'react' | 'vue' | 'angular' | 'html';

interface InstallInstructionsModalProps {
  formId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InstallInstructionsModal({ formId, open, onOpenChange }: InstallInstructionsModalProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      toast.success('Copied to clipboard')
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err) {
      toast.error('Failed to copy to clipboard')
    }
  }

  const getStackInstructions = (stack: FrameworkType) => {
    const instructions = {
      react: `// src/lib/userbird.ts
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

// src/App.tsx
import { useEffect } from 'react';
import { initUserbird } from './userbird';

function App() {
  useEffect(() => {
    async function loadWidget() {
      try {
        // Optional: Add user information
        window.UserBird.user = {
          id: 'user-123',      // Your user's ID
          email: 'user@example.com',  // User's email
          name: 'John Doe'     // User's name
        };

        await initUserbird("${formId}");
        console.log('Userbird widget loaded successfully');
      } catch (error) {
        console.error('Failed to load Userbird widget:', error);
      }
    }

    loadWidget();
  }, []);

  return (
    <button
      // Required ID format for keyboard shortcuts and positioning
      id="userbird-trigger-${formId}"
    >
      Feedback
    </button>
  );
}`,
      vue: `// userbird.ts
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

// App.vue
<script setup lang="ts">
import { onMounted } from 'vue'
import { initUserbird } from './userbird'

onMounted(async () => {
  try {
    // Optional: Add user information
    window.UserBird = window.UserBird || {};
    window.UserBird.user = {
      id: 'user-123',      // Your user's ID
      email: 'user@example.com',  // User's email
      name: 'John Doe'     // User's name
    };
    
    await initUserbird("${formId}");
    console.log('Userbird widget loaded successfully');
  } catch (error) {
    console.error('Failed to load Userbird widget:', error);
  }
})
</script>`,
      angular: `// userbird.service.ts
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class UserbirdService {
  private loaded = false;

  initUserbird(formId: string): Promise<boolean> {
    if (this.loaded) return Promise.resolve(true);

    return new Promise((resolve, reject) => {
      window.UserBird = window.UserBird || {};
      window.UserBird.formId = formId;
      
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

// app.component.ts
import { Component, OnInit } from '@angular/core';
import { UserbirdService } from './userbird.service';

@Component({
  selector: 'app-root',
  template: \`
    <!-- Option A: Use your own trigger button (‼️Recommended‼️) */}
    <button (click)="openFeedback($event)">
      Custom Feedback Button
    </button>

    <!-- Option B: Use our default trigger button -->
    <button id="userbird-trigger-${formId}">
      Feedback
    </button>
  \`
})
export class AppComponent implements OnInit {
  constructor(private userbird: UserbirdService) {}

  async ngOnInit() {
    try {
      // Optional: Add user information
      window.UserBird = window.UserBird || {};
      window.UserBird.user = {
        id: 'user-123',      // Your user's ID
        email: 'user@example.com',  // User's email
        name: 'John Doe'     // User's name
      };
      
      await this.userbird.initUserbird("${formId}");
      console.log('Userbird widget loaded successfully');
    } catch (error) {
      console.error('Failed to load Userbird widget:', error);
    }
  }

  openFeedback(event: MouseEvent) {
    window.UserBird?.open(event.currentTarget as HTMLElement);
  }
}`,
      html: `<!-- Option A: Use your own custom button (‼️Recommended‼️) -->
<button onclick="UserBird.open(this)">Custom Feedback</button>

<!-- Option B: Use our default button -->
<button id="userbird-trigger-${formId}">Feedback</button>

<!-- Initialize Userbird -->
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
</script>`
    };
    return instructions[stack];
  };

  const [activeTab, setActiveTab] = useState<FrameworkType>('react')
  const CodeBlock = ({ id, code }: { id: string, code: string }) => (
    <div className="relative">
      <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm leading-relaxed font-mono">
        <code>{code}</code>
      </pre>
      <Button
        size="icon"
        variant="ghost"
        className="absolute top-3 right-3 h-6 w-6"
        onClick={() => handleCopy(code, id)}
      >
        {copiedId === id ? (
          <Check className="h-3 w-3" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
      </Button>
    </div>
  )


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Installation Instructions</DialogTitle>
        </DialogHeader>
        
        <Tabs 
          defaultValue="react" 
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as FrameworkType)}
          className="w-full flex-1 overflow-hidden flex flex-col"
        >
          <div className="mb-4">
            <TabsList className="w-fit">
              <TabsTrigger value="react">React</TabsTrigger>
              <TabsTrigger value="vue">Vue</TabsTrigger>
              <TabsTrigger value="angular">Angular</TabsTrigger>
              <TabsTrigger value="html">HTML/JavaScript</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="react" className="space-y-4 flex-1 overflow-y-auto">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold mb-2">React Integration</h3>
                <Button
                  variant="default"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    const content = `React Integration Instructions

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
import { initUserbird } from './userbird';

function App() {
  useEffect(() => {
    async function loadWidget() {
      try {
        // Optional: Add user information
        window.UserBird.user = {
          id: 'user-123',      // Your user's ID
          email: 'user@example.com',  // User's email
          name: 'John Doe'     // User's name
        };
        
        await initUserbird("${formId}");
        console.log('Userbird widget loaded successfully');
      } catch (error) {
        console.error('Failed to load Userbird widget:', error);
      }
    }
    
    loadWidget();
  }, []);

  return (
    <button
      // Required ID format for keyboard shortcuts and positioning
      id="userbird-trigger-${formId}"
    >
      Feedback
    </button>
  );
}`;
                    handleCopy(content, 'copy-react');
                  }}
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
                  <CodeBlock id="react-util" code={`// src/lib/userbird.ts
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
}`}
                  />
                </div>

                <div className="rounded-lg border p-4 bg-muted/50">
                  <h4 className="text-sm font-medium mb-2">Step 2: Use in your component</h4>
                  <p className="text-sm text-muted-foreground mb-2">⚠️ IMPORTANT: Read these warnings to avoid common issues:</p>
                  <ul className="text-sm text-muted-foreground mb-4 list-disc pl-4 space-y-1">
                    <li>Never mix React initialization with direct UserBird.open() calls</li>
                    <li>The button ID format userbird-trigger-{formId} is required</li>
                    <li>Don't add onClick handlers that call UserBird.open()</li>
                  </ul>
                  <CodeBlock id="react-component" code={`// src/App.tsx
import { useEffect } from 'react';
import { initUserbird } from './userbird';

function App() {
  useEffect(() => {
    async function loadWidget() {
      try {
        // Optional: Add user information
        window.UserBird.user = {
          id: 'user-123',      // Your user's ID
          email: 'user@example.com',  // User's email
          name: 'John Doe'     // User's name
        };

        await initUserbird("${formId}");
        console.log('Userbird widget loaded successfully');
      } catch (error) {
        console.error('Failed to load Userbird widget:', error);
      }
    }

    loadWidget();
  }, []);

  return (
    <button
      // Required ID format for keyboard shortcuts and positioning
      id="userbird-trigger-${formId}"
    >
      Feedback
    </button>
  );
}`}
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="vue" className="space-y-4 flex-1 overflow-y-auto">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-medium">Vue Integration</h3>
                <Button
                  variant="default"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    const content = `Vue Integration Instructions\n\n` +
                      'Step 1: Create a composable function\n\n' +
                      '// userbird.ts\n' +
                      getStackInstructions('vue').split('// App.vue')[0] +
                      '\nStep 2: Use in your component\n\n' +
                      '// App.vue\n' +
                      getStackInstructions('vue').split('// App.vue')[1];
                    handleCopy(content, 'copy-vue');
                  }}
                >
                  {copiedId === 'copy-vue' ? (
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
              <p className="text-sm text-muted-foreground mb-4">Add this code to your Vue component:</p>
              <div className="space-y-4">
                <div className="rounded-lg border p-4 bg-muted/50">
                  <h4 className="text-sm font-medium mb-2">Step 1: Create a composable function</h4>
                  <CodeBlock
                    id="vue-util"
                    code={`// userbird.ts
export function useUserbird(formId: string) {
  return new Promise((resolve, reject) => {
    window.UserBird = window.UserBird || {};
    window.UserBird.formId = formId;
    
    const script = document.createElement('script');
    script.src = 'https://userbird.netlify.app/widget.js';
    
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error('Failed to load Userbird widget'));
    
    document.head.appendChild(script);
  });
}`}
                  />
                </div>

                <div className="rounded-lg border p-4 bg-muted/50">
                  <h4 className="text-sm font-medium mb-2">Step 2: Use in your component</h4>
                  <CodeBlock
                    id="vue-component"
                    code={`<!-- App.vue -->
<script setup lang="ts">
import { onMounted } from 'vue'
import { useUserbird } from './userbird'

onMounted(async () => {
  try {
    // Optional: Add user information
    window.UserBird = window.UserBird || {};
    window.UserBird.user = {
      id: 'user-123',      // Your user's ID
      email: 'user@example.com',  // User's email
      name: 'John Doe'     // User's name
    };
    
    await useUserbird("${formId}");
    console.log('Userbird widget loaded successfully');
  } catch (error) {
    console.error('Failed to load Userbird widget:', error);
  }
})
</script>

<template>
  <!-- Option A: Use your own trigger button (‼️Recommended‼️) */}
  <button @click="$event => window.UserBird?.open($event.currentTarget)">
    Custom Feedback Button
  </button>

  <!-- Option B: Use our default trigger button -->
  <button :id="\`userbird-trigger-${formId}\`">
    Feedback
  </button>
</template>`}
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="angular" className="space-y-4 flex-1 overflow-y-auto">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-medium">Angular Integration</h3>
                <Button
                  variant="default"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    const content = `Angular Integration Instructions\n\n` +
                      'Step 1: Create a service\n\n' +
                      '// userbird.service.ts\n' +
                      getStackInstructions('angular').split('// app.component.ts')[0] +
                      '\nStep 2: Use in your component\n\n' +
                      '// app.component.ts\n' +
                      getStackInstructions('angular').split('// app.component.ts')[1];
                    handleCopy(content, 'copy-angular');
                  }}
                >
                  {copiedId === 'copy-angular' ? (
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
              <p className="text-sm text-muted-foreground mb-4">Add this code to your Angular application:</p>
              <div className="space-y-4">
                <div className="rounded-lg border p-4 bg-muted/50">
                  <h4 className="text-sm font-medium mb-2">Step 1: Create a service</h4>
                  <CodeBlock
                    id="angular-service"
                    code={`// userbird.service.ts
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class UserbirdService {
  private loaded = false;

  initUserbird(formId: string): Promise<boolean> {
    if (this.loaded) return Promise.resolve(true);

    return new Promise((resolve, reject) => {
      window.UserBird = window.UserBird || {};
      window.UserBird.formId = formId;
      
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
}`}
                  />
                </div>

                <div className="rounded-lg border p-4 bg-muted/50">
                  <h4 className="text-sm font-medium mb-2">Step 2: Use in your component</h4>
                  <CodeBlock
                    id="angular-component"
                    code={`// app.component.ts
import { Component, OnInit } from '@angular/core';
import { UserbirdService } from './userbird.service';

@Component({
  selector: 'app-root',
  template: \`
    <!-- Option A: Use your own trigger button (‼️Recommended‼️) */}
    <button (click)="openFeedback($event)">
      Custom Feedback Button
    </button>

    <!-- Option B: Use our default trigger button -->
    <button id="userbird-trigger-${formId}">
      Feedback
    </button>
  \`
})
export class AppComponent implements OnInit {
  constructor(private userbird: UserbirdService) {}

  async ngOnInit() {
    try {
      // Optional: Add user information
      window.UserBird = window.UserBird || {};
      window.UserBird.user = {
        id: 'user-123',      // Your user's ID
        email: 'user@example.com',  // User's email
        name: 'John Doe'     // User's name
      };
      
      await this.userbird.initUserbird("${formId}");
      console.log('Userbird widget loaded successfully');
    } catch (error) {
      console.error('Failed to load Userbird widget:', error);
    }
  }

  openFeedback(event: MouseEvent) {
    window.UserBird?.open(event.currentTarget as HTMLElement);
  }
}`}
                  />
                </div>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="html" className="space-y-4 flex-1 overflow-y-auto">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-medium">HTML Integration</h3>
                <Button
                  variant="default"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    const content = `HTML Integration Instructions\n\n` +
                      'Step 1: Add the trigger button\n\n' +
                      getStackInstructions('html').split('<!-- Initialize')[0] +
                      '\nStep 2: Initialize the widget\n\n' +
                      '<!-- Initialize' + getStackInstructions('html').split('<!-- Initialize')[1];
                    handleCopy(content, 'copy-html');
                  }}
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
                  <CodeBlock
                    id="html-button"
                    code={`<!-- Option A: Use your own custom button (‼️Recommended‼️) -->
<button onclick="UserBird.open(this)">Custom Feedback</button>

<!-- Option B: Use our default button -->
<button id="userbird-trigger-${formId}">Feedback</button>`}
                  />
                  <p className="text-xs text-muted-foreground">Note: The button can be placed anywhere in your HTML</p>
                </div>

                <div className="rounded-lg border p-4 bg-muted/50">
                  <h4 className="text-sm font-medium mb-2">Step 2: Initialize the widget</h4>
                  <p className="text-sm text-muted-foreground mb-2">Add this initialization code:</p>
                  <CodeBlock
                    id="html-init"
                    code={`<!-- Initialize Userbird -->
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
</script>`}
                  />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
        <div className="mt-4 rounded-lg border p-4 bg-muted/50">
          <h4 className="text-sm font-medium mb-2">Important Notes</h4>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>• The widget script will automatically handle positioning relative to the trigger button</li>
            <li>• Always pass the trigger button element to UserBird.open() for proper positioning</li>
            <li>• User information is optional but recommended for better feedback tracking</li>
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  )
}