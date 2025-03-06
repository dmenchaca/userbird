import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthGuard } from './components/auth-guard';
import { LoginPage } from './pages/auth/login';
import { SignupPage } from './pages/auth/signup';
import { CallbackPage } from './pages/auth/callback';
import { Dashboard } from './pages/dashboard';
import { FormView } from './pages/form-view';

export default function App() {
  return (
    <>
      <Toaster position="bottom-center" />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/auth/callback" element={<CallbackPage />} />
        <Route path="/forms/:formId" element={
          <AuthGuard>
            <FormView />
          </AuthGuard>
        } />
        <Route
          path="/"
          element={
            <AuthGuard>
              <Dashboard />
            </AuthGuard>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}