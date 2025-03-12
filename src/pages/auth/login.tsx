import { Bird } from 'lucide-react'
import { LoginForm } from '@/components/auth/login-form'

export function LoginPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <a href="/" className="flex items-center gap-2 self-center font-medium">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Bird className="size-4" />
          </div>
          Userbird
        </a>
        <LoginForm />
      </div>
    </div>
  )
}