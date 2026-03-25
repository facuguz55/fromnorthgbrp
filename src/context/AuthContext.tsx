import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface User {
  name: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => void;
  updateName: (name: string) => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('nova_auth_user');
    if (saved) {
      try { setUser(JSON.parse(saved)); } catch { /* ignore */ }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    const users: Array<{ name: string; email: string; password: string }> =
      JSON.parse(localStorage.getItem('nova_users') || '[]');
    const found = users.find(u => u.email === email && u.password === password);
    if (found) {
      const userData = { name: found.name, email: found.email };
      setUser(userData);
      localStorage.setItem('nova_auth_user', JSON.stringify(userData));
      return true;
    }
    return false;
  };

  const register = async (name: string, email: string, password: string): Promise<boolean> => {
    const users: Array<{ name: string; email: string; password: string }> =
      JSON.parse(localStorage.getItem('nova_users') || '[]');
    if (users.find(u => u.email === email)) return false;
    users.push({ name, email, password });
    localStorage.setItem('nova_users', JSON.stringify(users));
    const userData = { name, email };
    setUser(userData);
    localStorage.setItem('nova_auth_user', JSON.stringify(userData));
    return true;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('nova_auth_user');
  };

  const updateName = (name: string) => {
    if (!user) return;
    const updated = { ...user, name };
    setUser(updated);
    localStorage.setItem('nova_auth_user', JSON.stringify(updated));
    // Also update in users list
    const users: Array<{ name: string; email: string; password: string }> =
      JSON.parse(localStorage.getItem('nova_users') || '[]');
    const idx = users.findIndex(u => u.email === user.email);
    if (idx !== -1) {
      users[idx].name = name;
      localStorage.setItem('nova_users', JSON.stringify(users));
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, updateName, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
