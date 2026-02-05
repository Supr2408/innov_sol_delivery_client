import { Link, NavLink } from "react-router-dom";

const Navbar = () => {
  return (
    <nav className="bg-white shadow-md px-8 py-4 flex justify-between">
      <Link to="/" className="text-xl font-semibold text-red-500">
        InnovSol Delivery
      </Link>

      <div className="flex gap-6 font-medium">
        <NavLink to="/admin-login">Admin</NavLink>
        <NavLink to="/user-login">User</NavLink>
        <NavLink to="/partner-login">Partner</NavLink>
        <NavLink to="/store-login">Store</NavLink>
      </div>
    </nav>
  );
};

export default Navbar;
