'use client'; // Next.js ko batate hain ki login yaad rakhne wala hissa browser mein chalega, kyunki wahi localStorage sambhalta hai.

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

// React Context ko common notice-board jaisa samjho: Provider ke andar ke sab pages yahan ki login jaankari padh sakte hain.
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
  // React ka useState value yaad rakhta hai; set karne par React un pages ko phir dikhata hai jo is value ko padhte hain.
  const [user, setUser] = useState<UserSession | null>(null);       // Current user ka data
  const [token, setToken] = useState<string | null>(null);          // JWT auth token
  const [isLoading, setIsLoading] = useState(true);                 // Initial session check loading indicator

  // React ka useEffect screen pehli baar banne ke baad chalta hai; [] ka matlab is kaam ko bas ek baar karna.
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

  // Provider apne andar ke sab pages ko ek hi user, login receipt aur login/logout ka saanjha set deta hai.
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

// useAuth ek chhota darwaza hai jisse koi bhi andar ka page saanjhi login jaankari padh sakta hai.
export function useAuth() {
  return useContext(AuthContext);
}
