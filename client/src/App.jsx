import React, { useContext } from "react";
import Navbar from "./components/Navbar";
import { Route, Routes } from "react-router-dom";
import Home from "./pages/landing/Home";
import AdminLogin from "./pages/auth/AdminLogin";
import UserLogin from "./pages/auth/UserLogin";
import PartnerLogin from "./pages/auth/PartnerLogin";
import StoreLogin from "./pages/auth/StoreLogin";
import StoreDashboard from "./pages/store/StoreDashboard";
import PartnerDashboard from "./pages/partner/PartnerDashboard";
import AdminDashboard from "./pages/admin/AdminDashboard";
import Footer from "./components/Footer";

import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import UserDashboard from "./pages/user/UserDashboard";
import { AppContext } from "./context/appContext";
import UserNavbar from "./components/UserNavbar";
import StoreNavbar from "./components/StoreNavbar";
import PartnerNavbar from "./components/PartnerNavbar";
import AdminNavbar from "./components/AdminNavbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Unauthorized from "./pages/errors/Unauthorized";
import NotFound from "./pages/errors/NotFound";

const App = () => {
  const { isAuthenticated, userRole, authLoading } = useContext(AppContext);

  return (
    <div className="min-h-screen flex flex-col">
      <ToastContainer position="bottom-right" />
      {authLoading && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-white/85 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-5 py-3 shadow-lg">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            <p className="text-sm font-medium text-gray-700">Loading session...</p>
          </div>
        </div>
      )}

      {/* NAVBAR */}
      {!isAuthenticated && <Navbar />}
      {isAuthenticated && userRole === "user" && <UserNavbar />}
      {isAuthenticated && userRole === "store" && <StoreNavbar />}
      {isAuthenticated && userRole === "partner" && <PartnerNavbar />}
      {isAuthenticated && userRole === "admin" && <AdminNavbar />}

      {/* MAIN CONTENT */}
      <main className="flex-grow">
        <Routes>
          {/* PUBLIC */}
          <Route path="/" element={<Home />} />
          <Route path="/user-login" element={<UserLogin />} />
          <Route path="/store-login" element={<StoreLogin />} />
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/partner-login" element={<PartnerLogin />} />

          {/* ADMIN */}
          <Route
            path="/admin-dashboard"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* USER */}
          <Route
            path="/user-dashboard"
            element={
              <ProtectedRoute allowedRoles={["user"]}>
                <UserDashboard />
              </ProtectedRoute>
            }
          />

          {/* STORE */}
          <Route
            path="/store-dashboard"
            element={
              <ProtectedRoute allowedRoles={["store"]}>
                <StoreDashboard />
              </ProtectedRoute>
            }
          />

          {/* PARTNER */}
          <Route
            path="/partner-dashboard"
            element={
              <ProtectedRoute allowedRoles={["partner"]}>
                <PartnerDashboard />
              </ProtectedRoute>
            }
          />

          {/* ERRORS */}
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      {/* FOOTER */}
      {!isAuthenticated && <Footer />}
    </div>
  );
};

export default App;
