import { Button } from '../ui/button'
import { Files, Check } from 'lucide-react'
import { CodeBlock } from '../code-block'

interface InstallInstructionsAngularProps {
  formId: string
  copiedId: string | null
  handleCopy: (text: string, id: string) => void
}

export function InstallInstructionsAngular({ formId, copiedId, handleCopy }: InstallInstructionsAngularProps) {
  const serviceCode = `// userbird.service.ts
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
}`;

  const componentCode = `// app.component.ts
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
}`;

  const fullInstructions = `Angular Integration Instructions

Step 1: Create a service

${serviceCode}

Step 2: Use in your component

${componentCode}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-medium">Angular Integration</h3>
        <Button
          variant="default"
          size="sm"
          className="gap-2"
          onClick={() => handleCopy(fullInstructions, 'copy-angular')}
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
            code={serviceCode}
            copiedId={copiedId}
            onCopy={handleCopy}
          />
        </div>

        <div className="rounded-lg border p-4 bg-muted/50">
          <h4 className="text-sm font-medium mb-2">Step 2: Use in your component</h4>
          <CodeBlock
            id="angular-component"
            code={componentCode}
            copiedId={copiedId}
            onCopy={handleCopy}
          />
        </div>
      </div>
    </div>
  );
} 