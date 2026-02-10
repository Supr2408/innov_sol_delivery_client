import { useContext, useState } from "react";
import { AppContext } from "../context/AppContext";
import { useNavigate } from "react-router-dom";

const PartnerNavbar = () => {
  const { user, logout } = useContext(AppContext);
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);

  const firstLetter = user?.name?.charAt(0)?.toUpperCase() || "P";

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <nav className="bg-white shadow-md px-6 sm:px-8 py-4 flex justify-between items-center">
      <h1
        className="text-lg sm:text-xl font-semibold text-blue-600 cursor-pointer"
        onClick={() => navigate("/partner-dashboard")}
      >
        InnovSol Partner
      </h1>

      <div className="flex items-center gap-3 sm:gap-4">
        <div
          className="relative"
          onMouseEnter={() => setShowProfile(true)}
          onMouseLeave={() => setShowProfile(false)}
        >
          <div className="w-10 h-10 flex items-center justify-center rounded-full bg-blue-600 text-white font-semibold cursor-pointer">
            {firstLetter}
          </div>

          {showProfile && (
            <div className="absolute top-12 right-0 bg-white shadow-md rounded px-4 py-2 text-sm whitespace-nowrap">
              <p className="font-medium">{user?.name || "Partner"}</p>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
          )}
        </div>

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

export default PartnerNavbar;
