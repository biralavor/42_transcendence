import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './authContext';
import { apiJson } from '../utils/apiClient';


const UserContext = createContext(null);

export function UserProvider({ children }) {
  const { auth, isAuthReady } = useAuth();
  const [user, setUser] = useState(null);

  useEffect(() => {

     if (!isAuthReady) return;
     if (!auth?.access_token) {
       setUser(null);
       return;
     }
     let isCurrent = true;

     const controller = new AbortController()
     const { signal } = controller
    
    apiJson('/api/users/auth/me', { signal })
       .then(user => {
         if (!isCurrent) return;
         console.log('setting user: ', user)
         setUser(user)
       })
      .catch(err => {
         if (!isCurrent) return;
         if (err.name !== 'AbortError')
           console.warn('Failed to fetch user', err)
         setUser(null)
       });
     return () => {
       isCurrent = false;
       controller.abort();
     };
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
