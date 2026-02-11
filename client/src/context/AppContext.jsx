import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { AppContext } from "./appContext";

const AppContextProvider = (props) => {
  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  const [token, setToken] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(
    localStorage.getItem("user")
      ? JSON.parse(localStorage.getItem("user"))
      : null
  );
  const [authLoading, setAuthLoading] = useState(true);
  const hasHandledUnauthorizedError = useRef(false);

  const isAuthenticated = !!token;
  const userRole = user?.role || null;

  const logout = useCallback((showToastMessage = true) => {
    localStorage.clear();
    setToken(null);
    setUser(null);
    if (showToastMessage) {
      toast.success("Logged out");
    }
  }, []);

  useEffect(() => {
    axios.defaults.baseURL = backendUrl;

    if (token) {
      axios.defaults.headers.common.Authorization = `Bearer ${token}`;
      hasHandledUnauthorizedError.current = false;
    } else {
      delete axios.defaults.headers.common.Authorization;
    }

    const authLoadingTimeoutId = setTimeout(() => {
      setAuthLoading(false);
    }, 0);

    return () => {
      clearTimeout(authLoadingTimeoutId);
    };
  }, [backendUrl, token]);

  useEffect(() => {
    const interceptorId = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error?.response?.status === 401 && token && !hasHandledUnauthorizedError.current) {
          hasHandledUnauthorizedError.current = true;
          logout(false);
          toast.error("Session expired. Please log in again.");
        }

        return Promise.reject(error);
      },
    );

    return () => {
      axios.interceptors.response.eject(interceptorId);
    };
  }, [logout, token]);

  useEffect(() => {
    if (user) localStorage.setItem("user", JSON.stringify(user));
    else localStorage.removeItem("user");
  }, [user]);

  return (
    <AppContext.Provider
      value={{
        token,
        setToken,
        user,
        setUser,
        isAuthenticated,
        userRole,
        authLoading,
        logout,
      }}
    >
      {props.children}
    </AppContext.Provider>
  );
};

export default AppContextProvider;
