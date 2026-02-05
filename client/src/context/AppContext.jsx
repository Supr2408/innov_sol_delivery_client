import { createContext, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";

export const AppContext = createContext();

const AppContextProvider = (props) => {
  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  const [token, setToken] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(
    localStorage.getItem("user")
      ? JSON.parse(localStorage.getItem("user"))
      : null
  );
  const [authLoading, setAuthLoading] = useState(true);

  const isAuthenticated = !!token;
  const userRole = user?.role || null;

  useEffect(() => {
    axios.defaults.baseURL = backendUrl;

    if (token) {
      axios.defaults.headers.common.Authorization = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common.Authorization;
    }

    setAuthLoading(false);
  }, [token]);

  useEffect(() => {
    if (user) localStorage.setItem("user", JSON.stringify(user));
    else localStorage.removeItem("user");
  }, [user]);

  const logout = () => {
    localStorage.clear();
    setToken(null);
    setUser(null);
    toast.success("Logged out");
  };

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
