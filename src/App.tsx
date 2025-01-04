import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthGuard } from './components/auth-guard';
import { LoginPage } from './pages/auth/login';
import { SignupPage } from './pages/auth/signup';
import { Dashboard } from './pages/dashboard';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
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
  )
}