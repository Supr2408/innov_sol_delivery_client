import React, { useContext } from "react";
import Navbar from "./components/Navbar";
import { Route, Routes } from "react-router-dom";
import Home from "./pages/landing/Home";
import AdminLogin from "./pages/auth/AdminLogin";
import UserLogin from "./pages/auth/UserLogin";
import PartnerLogin from "./pages/auth/PartnerLogin";
import StoreLogin from "./pages/auth/StoreLogin";
import Footer from "./components/Footer";

import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import UserDashboard from "./pages/user/UserDashboard";
import { AppContext } from "./context/AppContext";
import UserNavbar from "./components/UserNavbar";

const App = () => {
  const { isAuthenticated, userRole } = useContext(AppContext);
  return (
    <div>
      <ToastContainer position="bottom-right" />
      
      {/* 🔁 NAVBAR DECISION */}
      {!isAuthenticated && <Navbar />}

      {isAuthenticated && userRole === "user" && <UserNavbar />}


      <div>
        <Routes>
          <Route path="/" element={<Home />} />

          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/user-login" element={<UserLogin />} />
          <Route path="/partner-login" element={<PartnerLogin />} />
          <Route path="/store-login" element={<StoreLogin />} />

          {/* Placeholder routes for dashboards */}
          <Route path="/user-dashboard" element={<UserDashboard />} />
        </Routes>
      </div>

      <Footer />
    </div>
  );
};

export default App;
