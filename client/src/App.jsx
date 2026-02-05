import React from "react";
import Navbar from "./components/Navbar";
import { Route, Routes } from "react-router-dom";
import Home from "./pages/landing/Home";
import AdminLogin from "./pages/auth/AdminLogin";
import UserLogin from "./pages/auth/UserLogin";
import PartnerLogin from "./pages/auth/PartnerLogin";
import StoreLogin from "./pages/auth/StoreLogin";
import StoreDashboard from "./pages/store/StoreDashboard";
import Footer from "./components/Footer";

import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";


const App = () => {
  return (
    <div>
      <ToastContainer position="bottom-right" />
      <Navbar />
      {/* Other components and routes will go here */}
      <div>
        <Routes>
          <Route path="/" element={<Home />} />

          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/user-login" element={<UserLogin />} />
          <Route path="/partner-login" element={<PartnerLogin />} />
          <Route path="/store-login" element={<StoreLogin />} />
          
          <Route path="/store-dashboard" element={<StoreDashboard />} />
        </Routes>
      </div>

      <Footer />
    </div>
  );
};

export default App;
