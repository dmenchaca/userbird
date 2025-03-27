import { Button } from '../ui/button'
import { Files, Check } from 'lucide-react'
import { CodeBlock } from '../code-block'

interface InstallInstructionsVueProps {
  formId: string
  copiedId: string | null
  handleCopy: (text: string, id: string) => void
}

export function InstallInstructionsVue({ formId, copiedId, handleCopy }: InstallInstructionsVueProps) {
  const utilCode = `// userbird.ts
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
}`;

  const componentCode = `<!-- App.vue -->
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
</template>`;

  const fullInstructions = `Vue Integration Instructions

Step 1: Create a composable function

// userbird.ts
${utilCode}

Step 2: Use in your component

${componentCode}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-medium">Vue Integration</h3>
        <Button
          variant="default"
          size="sm"
          className="gap-2"
          onClick={() => handleCopy(fullInstructions, 'copy-vue')}
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
            code={utilCode}
            copiedId={copiedId}
            onCopy={handleCopy}
          />
        </div>

        <div className="rounded-lg border p-4 bg-muted/50">
          <h4 className="text-sm font-medium mb-2">Step 2: Use in your component</h4>
          <CodeBlock
            id="vue-component"
            code={componentCode}
            copiedId={copiedId}
            onCopy={handleCopy}
          />
        </div>
      </div>
    </div>
  );
} 