import { useCallback, useMemo, useState } from "react";
import { AUTH_STORAGE_KEY } from "../constants/auth";
import AuthContext from "./auth-context";
import { loginUser, signupSchoolAdmin } from "../services/schoolApi";

const readStoredUser = () => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readStoredUser());

  const login = useCallback(async (email, password) => {
    const safeUser = await loginUser(email, password);

    setUser(safeUser);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(safeUser));
    return safeUser;
  }, []);

  const signup = useCallback(async (payload) => {
    const safeUser = await signupSchoolAdmin(payload);

    setUser(safeUser);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(safeUser));
    return safeUser;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      login,
      signup,
      logout,
    }),
    [login, logout, signup, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
