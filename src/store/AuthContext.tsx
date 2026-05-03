import { createContext, useState, type ReactNode } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  token: string | null;

  privateKey: CryptoKey | null;
  setPrivateKey: (key: CryptoKey | null) => void;

  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem('token')
  );

  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);

  const isAuthenticated = !!token;

  const login = (newToken: string) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);

    // 🔐 wipe private key on logout for security
    setPrivateKey(null);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        token,
        privateKey,
        setPrivateKey,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export { AuthContext };