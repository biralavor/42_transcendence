import { Outlet } from 'react-router';
import { Header } from './Header';
import { Footer } from './Footer';
import { AuthProvider } from '../contexts/AuthContext';

export function Layout() {
  return (
    <AuthProvider>
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">
          <Outlet />
        </main>
        <Footer />
      </div>
    </AuthProvider>
  );
}
