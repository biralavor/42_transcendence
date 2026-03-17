import { createContext, useContext, useState, ReactNode } from 'react';

interface User {
  id: string;
  username: string;
  email: string;
  profileImage?: string;
  points: number;
  isAnonymous: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isAnonymous: boolean;
  login: (username: string, email: string) => void;
  loginAnonymous: () => void;
  logout: () => void;
  updateProfile: (data: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const login = (username: string, email: string) => {
    setUser({
      id: Math.random().toString(36).substring(7),
      username,
      email,
      points: 2350,
      isAnonymous: false,
    });
  };

  const loginAnonymous = () => {
    setUser({
      id: Math.random().toString(36).substring(7),
      username: 'Jogador Anônimo',
      email: '',
      points: 0,
      isAnonymous: true,
    });
  };

  const logout = () => {
    setUser(null);
  };

  const updateProfile = (data: Partial<User>) => {
    if (user && !user.isAnonymous) {
      setUser({ ...user, ...data });
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: user !== null,
    isAnonymous: user?.isAnonymous || false,
    login,
    loginAnonymous,
    logout,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
