import { useContext, useState } from "react";
import { AppContext } from "../context/appContext";
import { useNavigate } from "react-router-dom";

const StoreNavbar = () => {
  const { user, logout } = useContext(AppContext);
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);

  const firstLetter = user?.storeName?.charAt(0).toUpperCase();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <nav className="bg-white shadow-md px-8 py-4 flex justify-between items-center">
      {/* LEFT */}
      <h1
        className="text-xl font-semibold text-red-500 cursor-pointer"
        onClick={() => navigate("/store-dashboard")}
      >
        InnovSol Delivery
      </h1>

      {/* RIGHT */}
      <div className="flex items-center gap-4">
        {/* PROFILE */}
        <div
          className="relative"
          onMouseEnter={() => setShowProfile(true)}
          onMouseLeave={() => setShowProfile(false)}
        >
          <div className="w-10 h-10 flex items-center justify-center rounded-full bg-red-500 text-white font-semibold cursor-pointer">
            {firstLetter}
          </div>

          {showProfile && (
            <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-white shadow-md rounded px-4 py-2 text-sm whitespace-nowrap">
              <p className="font-medium">{user?.storeName}</p>
            </div>
          )}
        </div>

        {/* LOGOUT */}
        <button
          onClick={handleLogout}
          className="text-sm bg-gray-100 px-3 py-1 rounded cursor-pointer hover:bg-gray-200"
        >
          Logout
        </button>
      </div>
    </nav>
  );
};

export default StoreNavbar;
