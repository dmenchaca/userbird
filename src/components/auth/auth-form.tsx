import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle } from "lucide-react"
import { useAuth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"

interface AuthFormProps extends React.HTMLAttributes<HTMLDivElement> {
  mode: 'login' | 'signup'
}

export function AuthForm({ className, mode, ...props }: AuthFormProps) {
  const navigate = useNavigate()
  const { signInWithGoogle } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to sign in with Google')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (mode === 'login') {
        const { error, data } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) throw error
        
        if (data.session) {
          navigate('/')
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        })

        if (error) throw error
        
        if (data.user) {
          // User was created successfully, now link any pending invitations
          try {
            await fetch('/.netlify/functions/link-user-invitations', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: data.user.id,
                email: data.user.email
              })
            });
            // Note: We don't wait for a response or handle errors from this call
            // because we don't want to block the signup flow if the invitation linking fails
          } catch (invitationError) {
            // Log but don't fail the signup
            console.error('Error linking invitations:', invitationError);
          }
        }
        
        setSuccess(true)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : `Failed to ${mode === 'login' ? 'sign in' : 'sign up'}`)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="space-y-4 text-center">
        <h2 className="text-xl font-semibold">Account Created!</h2>
        <p className="text-muted-foreground">
          You can now{" "}
          <a href="/login" className="underline underline-offset-4 hover:text-primary">
            sign in
          </a>{" "}
          with your email and password.
        </p>
      </div>
    )
  }

  return (
    <div className={cn("grid gap-3 sm:gap-6", className)} {...props}>
      <div className="flex flex-col text-center">
        <h1 className="font-[600] tracking-tight relative leading-[120%] text-[2rem] sm:text-[2.5rem] w-full sm:w-[372px] mx-auto">
          {mode === 'signup' ? 'Create account' : (
            <>
              You're losing users. Not because of bugs. But <span className="bg-gradient-to-r from-[hsl(210deg_100%_21.98%)] to-[#0061ff] bg-clip-text text-transparent">blind spots.</span>
            </>
          )}
        </h1>
        {mode === 'login' && (
          <p className="text-sm sm:text-base text-muted-foreground mx-2 sm:m-4 mt-3 sm:mt-4">
            Make continuous feedback part of your product and turn silent drop-offs into actionable product decisions.
          </p>
        )}
        <div className="flex justify-center mt-2 sm:mt-4 mb-2 sm:mb-4">
          <div className="inline-block py-1.5 sm:py-2 px-3 sm:px-4 rounded-full bg-muted text-center text-foreground text-sm sm:text-base">
            Beta test for free until June 1st 🚀
          </div>
        </div>
      </div>
      <div className="grid gap-4 sm:gap-6 animate-in fade-in-0 duration-500">
        {mode === 'login' && !showEmailForm && (
          <div className="grid gap-3 sm:gap-4">
            <Button 
              type="button"
              className="w-full sm:max-w-[17rem] mx-auto"
              onClick={handleGoogleSignIn}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="mr-2 h-4 w-4">
                <path
                  d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                  fill="currentColor"
                />
              </svg>
              Continue with Google
            </Button>
            
            <Button 
              type="button"
              variant="outline"
              className="w-full sm:max-w-[17rem] mx-auto"
              onClick={() => setShowEmailForm(true)}
            >
              Continue with email
            </Button>
          </div>
        )}
        {mode === 'signup' && (
          <Button 
            type="button"
            variant="outline"
            className="w-full sm:max-w-[17rem] mx-auto text-muted-foreground"
            onClick={handleGoogleSignIn}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="mr-2 h-4 w-4">
              <path
                d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                fill="currentColor"
              />
            </svg>
            Sign up with Google
          </Button>
        )}
        {mode === 'signup' && (
          <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
            <span className="relative z-10 bg-background px-2 text-muted-foreground">
              Or continue with
            </span>
          </div>
        )}
        {(mode === 'login' && showEmailForm) || mode === 'signup' ? (
          <form onSubmit={handleSubmit} className={cn(
            "grid gap-3 sm:gap-4",
            mode === 'signup' ? "animate-in fade-in-0" : "animate-in fade-in-0 slide-in-from-top-2"
          )}>
            <div className="grid gap-1.5 sm:gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                placeholder="name@example.com"
                type="email"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect="off"
                disabled={loading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5 sm:gap-2">
              <div className="flex items-center">
                <Label htmlFor="password">Password</Label>
                {mode === 'login' && (
                  <a
                    href="#"
                    className="ml-auto text-sm text-muted-foreground underline-offset-4 hover:underline"
                  >
                    Forgot your password?
                  </a>
                )}
              </div>
              <Input
                id="password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                disabled={loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}
            <Button type="submit" disabled={loading} className="w-full sm:max-w-[17rem] mx-auto">
              {loading ? (mode === 'login' ? "Signing in..." : "Creating account...") : (mode === 'login' ? "Sign in" : "Create Account")}
            </Button>
          </form>
        ) : null}
        
        <div className="text-center text-sm mt-2 sm:mt-3">
          {mode === 'login' ? (
            <>
              Don't have an account?{" "}
              <a href="/login?mode=signup" className="underline underline-offset-4 hover:text-primary">
                Sign up
              </a>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <a href="/login" className="underline underline-offset-4 hover:text-primary">
                Sign in
              </a>
            </>
          )}
        </div>
        {/* Terms of service and privacy policy - temporarily hidden
        <p className="px-4 sm:px-8 text-center text-sm text-muted-foreground w-full sm:w-[372px] mx-auto">
          By clicking continue, you agree to our{" "}
          <a href="#" className="underline underline-offset-4 hover:text-primary">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="#" className="underline underline-offset-4 hover:text-primary">
            Privacy Policy
          </a>
        </p>
        */}
      </div>
    </div>
  )
}