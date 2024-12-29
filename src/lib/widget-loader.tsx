import React from 'react'
import { createRoot } from 'react-dom/client'
import { FeedbackForm } from '@/components/feedback-form'

declare global {
  interface Window {
    Userbird: {
      init: (options: { formId: string }) => void
    }
  }
}

window.Userbird = {
  init: ({ formId }) => {
    // Create container
    const container = document.createElement('div')
    container.id = 'userbird-widget'
    document.body.appendChild(container)

    // Create React root and render
    const root = createRoot(container)
    root.render(
      <React.StrictMode>
        <FeedbackForm formId={formId} />
      </React.StrictMode>
    )

    return {
      destroy() {
        root.unmount()
        container.remove()
      }
    }
  }
}