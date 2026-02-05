import { useContext, useState } from "react";
import { AppContext } from "../context/AppContext";
import { useNavigate } from "react-router-dom";

const UserNavbar = () => {
  const { user, logout } = useContext(AppContext);
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);

  const firstLetter = user?.name?.charAt(0).toUpperCase();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <nav className="bg-white shadow-md px-8 py-4 flex justify-between items-center">
      {/* LEFT SIDE */}
      <h1 className="text-xl font-semibold text-red-500 ">InnovSol Delivery</h1>

      {/* RIGHT SIDE */}
      <div className="flex items-center gap-4">
        {/* PROFILE WRAPPER */}
        <div
          className="relative"
          onMouseEnter={() => setShowProfile(true)}
          onMouseLeave={() => setShowProfile(false)}
        >
          {/* PROFILE ICON */}
          <div className="w-10 h-10 flex items-center justify-center rounded-full bg-red-500 text-white font-semibold cursor-pointer">
            {firstLetter}
          </div>

          {/* PROFILE HOVER CARD */}
          {showProfile && (
            <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-white shadow-md rounded px-4 py-2 text-sm whitespace-nowrap transition-all duration-200">
              <p className="font-medium">{user?.name}</p>
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

export default UserNavbar;
