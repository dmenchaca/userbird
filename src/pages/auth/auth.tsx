@@ .. @@
 import { useSearchParams } from 'react-router-dom'
 
-export function AuthPage() {
}
+export function LoginPage() {
   const [searchParams] = useSearchParams()
   const mode = searchParams.get('mode') === 'signup' ? 'signup' : 'login'
}