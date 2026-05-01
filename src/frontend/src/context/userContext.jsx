import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './authContext';
import { apiJson, apiCall } from '../utils/apiClient';


const UserContext = createContext(null);

export function UserProvider({ children }) {
  const { auth, isAuthReady } = useAuth();
  const [user, setUser] = useState(null);

  useEffect(() => {
    
    if (!isAuthReady || !auth?.access_token) return;
    apiJson('/api/users/auth/me')
      .then(user => {
        console.log('setting user: ', user)
        setUser(user)
      })
      .catch(err => {
        if (err.name !== 'AbortError')
          console.warn('Failed to fetch user', err)
        setUser(null)
      })
  }, [isAuthReady, auth?.access_token]);


  return (
    <UserContext.Provider value={{ user, token: auth.access_token }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be inside UserProvider');
  return ctx;
}
