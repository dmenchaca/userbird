import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Tabs, TabsList, TabsTrigger } from './ui/tabs'
import { Button } from './ui/button'
import { Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface InstallInstructionsModalProps {
  formId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InstallInstructionsModal({ formId, open, onOpenChange }: InstallInstructionsModalProps) {
  const [activeTab, setActiveTab] = useState('react')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      toast.success('Copied to clipboard')
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err) {
      toast.error('Failed to copy')
    }
  }

  // React content
  const reactContent = `
React Integration Instructions

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
}
`;

  // Vue content
  const vueContent = `
Vue Integration Instructions

Step 1: Create a composable function

// userbird.ts
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
}

Step 2: Use in your component

<!-- App.vue -->
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
  <!-- Option A: Use your own trigger button (‼️Recommended‼️) -->
  <button @click="$event => window.UserBird?.open($event.currentTarget)">
    Custom Feedback Button
  </button>

  <!-- Option B: Use our default trigger button -->
  <button :id="\`userbird-trigger-${formId}\`">
    Feedback
  </button>
</template>
`;

  // Angular content
  const angularContent = `
Angular Integration Instructions

Step 1: Create a service

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

Step 2: Use in your component

// app.component.ts
import { Component, OnInit } from '@angular/core';
import { UserbirdService } from './userbird.service';

@Component({
  selector: 'app-root',
  template: \`
    <!-- Option A: Use your own trigger button (‼️Recommended‼️) -->
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
}
`;

  // HTML content
  const htmlContent = `
HTML Integration Instructions

Step 1: Add the trigger button

<!-- Option A: If you use a text button -->
<button onclick="UserBird.open(this)">Custom Feedback</button>

<!-- Option B: If you use an icon button (IMPORTANT: Add pointer-events-none to the icon!) -->
<button onclick="UserBird.open(this)">
  <svg class="h-6 w-6 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
</button>

Step 2: Initialize the widget

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
</script>
`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
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

        <div style={{ height: '70vh', overflowY: 'auto', padding: '16px', userSelect: 'text' }}>
          {activeTab === 'react' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3>React Integration</h3>
                <Button size="sm" onClick={() => handleCopy(reactContent, 'react')}>
                  {copiedId === 'react' ? <Check size={16} /> : <Copy size={16} />}
                </Button>
              </div>
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{reactContent}</pre>
            </div>
          )}

          {activeTab === 'vue' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3>Vue Integration</h3>
                <Button size="sm" onClick={() => handleCopy(vueContent, 'vue')}>
                  {copiedId === 'vue' ? <Check size={16} /> : <Copy size={16} />}
                </Button>
              </div>
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{vueContent}</pre>
            </div>
          )}

          {activeTab === 'angular' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3>Angular Integration</h3>
                <Button size="sm" onClick={() => handleCopy(angularContent, 'angular')}>
                  {copiedId === 'angular' ? <Check size={16} /> : <Copy size={16} />}
                </Button>
              </div>
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{angularContent}</pre>
            </div>
          )}

          {activeTab === 'html' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3>HTML Integration</h3>
                <Button size="sm" onClick={() => handleCopy(htmlContent, 'html')}>
                  {copiedId === 'html' ? <Check size={16} /> : <Copy size={16} />}
                </Button>
              </div>
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{htmlContent}</pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}