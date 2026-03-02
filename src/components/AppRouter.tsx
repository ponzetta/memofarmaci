import { useAuth } from '../contexts/AuthContext';
import LoginPage from '../pages/LoginPage';
import CompleteProfilePage from '../pages/CompleteProfilePage';
import App from '../App';

export default function AppRouter() {
  const { user, profileCompleted, loading } = useAuth();

  if (loading) {
    return (
      <div className="w-full max-w-md mx-auto h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500">Caricamento...</p>
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage />;
  if (!profileCompleted) return <CompleteProfilePage />;
  return <App />;
}
