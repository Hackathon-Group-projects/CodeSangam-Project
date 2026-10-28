'use client'; // Next.js ko batata hai ki ye component browser me chalega (server par nahi), kyunki yahan localStorage use ho raha hai

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Role } from '@vishanti/shared';

// TS CONCEPT (interface UserSession): 
// Logged-in user ka JavaScript object kaisa dikhega (id, name, email, role, department)
export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: Role;
  department?: string; // '?' ka matlab ye field optional hai (sirf officers ke liye hoga)
}

// TS CONCEPT (interface AuthContextType): 
// Global auth context ke andar kaun-kaun se variables aur functions honge
interface AuthContextType {
  user: UserSession | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: UserSession) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

// React Context create karte hain jo pure app me user state ko globally share karega
const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  login: () => {},
  logout: () => {},
  isAuthenticated: false,
});

// AuthProvider Component: Yeh pure website ko wrap karta hai taaki har page ko login info mile
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);       // Current user ka data
  const [token, setToken] = useState<string | null>(null);          // JWT auth token
  const [isLoading, setIsLoading] = useState(true);                 // Initial session check loading indicator

  // useEffect: Page refresh hone par ek baar chalta hai, aur localStorage se saved login restore karta hai
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem('vishanti_auth_token');
      const storedUser = localStorage.getItem('vishanti_auth_user');
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser)); // JSON string ko wapas JS object banate hain
      }
    } catch (err) {
      console.error('Failed to load session:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // login function: JWT token aur user info ko localStorage aur React state dono me save karta hai
  const login = (newToken: string, newUser: UserSession) => {
    localStorage.setItem('vishanti_auth_token', newToken);
    localStorage.setItem('vishanti_auth_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  // logout function: Session clear karke user ko landing page par bhejta hai
  const logout = () => {
    localStorage.removeItem('vishanti_auth_token');
    localStorage.removeItem('vishanti_auth_user');
    setToken(null);
    setUser(null);
    window.location.href = '/';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        logout,
        isAuthenticated: !!token, // Agar token maujood hai toh true, warna false
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Custom Hook: Kisi bhi component me bas `const { user, logout } = useAuth()` likh kar session use kar sakte hain
export function useAuth() {
  return useContext(AuthContext);
}
