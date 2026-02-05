import { Link, NavLink } from "react-router-dom";

const Navbar = () => {
  return (
    <nav className="bg-white shadow-md px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex justify-between items-center gap-2 sm:gap-4">
      <Link to="/" className="text-sm sm:text-lg lg:text-xl font-semibold text-red-500 truncate">
        InnovSol
      </Link>

      <div className="flex gap-2 sm:gap-4 lg:gap-6 font-medium text-xs sm:text-sm lg:text-base flex-wrap justify-end">
        <NavLink 
          to="/admin-login"
          className={({ isActive }) => isActive ? "text-red-500 font-bold" : "text-gray-700 hover:text-red-500"}
        >
          Admin
        </NavLink>
        <NavLink 
          to="/user-login"
          className={({ isActive }) => isActive ? "text-red-500 font-bold" : "text-gray-700 hover:text-red-500"}
        >
          User
        </NavLink>
        <NavLink 
          to="/partner-login"
          className={({ isActive }) => isActive ? "text-red-500 font-bold" : "text-gray-700 hover:text-red-500"}
        >
          Partner
        </NavLink>
        <NavLink 
          to="/store-login"
          className={({ isActive }) => isActive ? "text-red-500 font-bold" : "text-gray-700 hover:text-red-500"}
        >
          Store
        </NavLink>
      </div>
    </nav>
  );
};

export default Navbar;
