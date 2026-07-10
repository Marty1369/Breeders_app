import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './state/AuthProvider';
import { useSpace } from './state/SpaceProvider';
import { getPendingInvite } from './lib/invite';
import { Spinner } from './components/ui';
import AuthPage from './routes/auth/AuthPage';
import ForgotPassword from './routes/auth/ForgotPassword';
import CreateSpaceWizard from './routes/auth/CreateSpaceWizard';
import JoinInvite from './routes/auth/JoinInvite';
import AppShell from './routes/AppShell';

function FullScreenSpinner() {
  return (
    <div className="min-h-full grid place-items-center">
      <Spinner />
    </div>
  );
}

export default function App() {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) return <FullScreenSpinner />;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <AuthPage />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/join/:token" element={<JoinInvite />} />
      <Route path="/*" element={user ? <Authenticated /> : <Navigate to="/login" replace />} />
    </Routes>
  );
}

function Authenticated() {
  const { loading, hasSpace } = useSpace();
  if (loading) return <FullScreenSpinner />;

  // An authenticated user with no space yet: if they arrived via an invite,
  // send them to join it — never to create-space (that's how invitees used to
  // accidentally spin up a second kennel).
  const pendingInvite = hasSpace ? null : getPendingInvite();
  const noSpaceTarget = pendingInvite ? `/join/${pendingInvite}` : '/onboarding/create-space';

  return (
    <Routes>
      <Route
        path="/onboarding/create-space"
        element={hasSpace ? <Navigate to="/" replace /> : <CreateSpaceWizard />}
      />
      <Route
        path="/*"
        element={hasSpace ? <AppShell /> : <Navigate to={noSpaceTarget} replace />}
      />
    </Routes>
  );
}
