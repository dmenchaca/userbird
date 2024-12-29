import React from 'react'
import { FormCreator } from '../components/form-creator'

export default function HomePage() {
  return (
    <div className="container max-w-2xl py-12 space-y-8">
      <div className="space-y-2">
        <p className="text-muted-foreground">Create a feedback form for your website in seconds.</p>
      </div>
      <FormCreator />
    </div>
  )
}