import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthGuard } from './components/auth-guard';
import { AuthPage } from './pages/auth/auth';
import { CallbackPage } from './pages/auth/callback';
import { Dashboard } from './pages/dashboard';
import { FormView } from './pages/form-view';
import { useWorkspaceSetupCheck } from './lib/hooks/useWorkspaceSetupCheck';
import { WorkspaceSetupWizard } from './components/workspace-setup-wizard';
import { useEffect } from 'react';

export default function App() {
  const { needsSetupWizard } = useWorkspaceSetupCheck();

  // Log the workspace setup check result when it changes
  useEffect(() => {
    if (needsSetupWizard !== null) {
      console.log('App: Workspace setup wizard needed:', needsSetupWizard);
    }
  }, [needsSetupWizard]);

  return (
    <>
      <Toaster position="bottom-center" />
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route path="/auth/callback" element={<CallbackPage />} />
        <Route path="/setup-workspace" element={
          <AuthGuard>
            <WorkspaceSetupWizard onComplete={() => {}} />
          </AuthGuard>
        } />
        <Route path="/forms/:formId/ticket/:ticketNumber" element={
          <AuthGuard>
            <FormView />
          </AuthGuard>
        } />
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