import { createContext, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";

export const AppContext = createContext();

const AppContextProvider = (props) => {
  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  const [token, setToken] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(null);

  // 🔑 derived auth state
  const isAuthenticated = !!token;
  const userRole = user?.role || null;

  useEffect(() => {
    axios.defaults.baseURL = backendUrl;

    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common["Authorization"];
    }
  }, [token]);

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    toast.success("Logged out successfully");
  };

  const value = {
    backendUrl,
    token,
    setToken,
    user,
    setUser,
    isAuthenticated, // ✅ NEW
    userRole,        // ✅ NEW
    logout,
  };

  return (
    <AppContext.Provider value={value}>
      {props.children}
    </AppContext.Provider>
  );
};

export default AppContextProvider;
