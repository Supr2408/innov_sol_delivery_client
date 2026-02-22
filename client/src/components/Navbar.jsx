import { Link, NavLink, useLocation } from "react-router-dom";

const Navbar = () => {
  const location = useLocation();
  const isHome = location.pathname === "/";

  const navLinks = [
    { label: "Buyer", path: "/user-login" },
    { label: "Delivery", path: "/partner-login" },
    { label: "Supplier", path: "/store-login" }
    // { label: "Admin", path: "/admin-login" } // Admin login commented out
  ];

  return (
    <nav
      className={`fixed top-0 w-full z-50 px-6 lg:px-10 py-4 flex justify-between items-center transition-all duration-300
        ${isHome ? "bg-transparent text-white" : "bg-white shadow-md text-gray-800"}
      `}
    >
      <Link
        to="/"
        className="text-2xl lg:text-2xl font-bold tracking-tight hover:opacity-80 transition"
      >
        InnovSol
      </Link>

      <div className="flex gap-1 text-sm font-medium">
        {navLinks.map((link) => (
          <NavLink
            key={link.path}
            to={link.path}
            className={({ isActive }) =>
              `px-4 py-2 rounded-lg transition ${
                isActive
                  ? "bg-[#E23744] text-white"
                  : isHome
                  ? "text-white hover:bg-white/20"
                  : "text-gray-700 hover:text-[#E23744]"
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default Navbar;
