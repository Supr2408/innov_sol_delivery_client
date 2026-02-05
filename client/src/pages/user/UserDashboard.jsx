import { useContext } from "react";
import { AppContext } from "../../context/AppContext";

const UserDashboard = () => {
  const { user } = useContext(AppContext);

  // Extract first name safely
  const firstName = user?.name?.split(" ")[0];

  return (
    <div className="p-8">
      {/* WELCOME */}
      <h1 className="text-2xl font-semibold mb-6">
        Welcome, {firstName} 👋
      </h1>

      {/* STORES / ITEMS */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Available Stores</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 border rounded">Store A</div>
          <div className="p-4 border rounded">Store B</div>
          <div className="p-4 border rounded">Store C</div>
        </div>
      </section>

      {/* ORDER HISTORY */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">My Orders</h2>
        <div className="border p-4 rounded">No orders yet</div>
      </section>

      {/* LIVE TRACKING */}
      <section>
        <h2 className="text-xl font-semibold mb-2">Live Tracking</h2>
        <div className="border p-4 rounded text-gray-500">
          Live tracking will appear here once an order is out for delivery
        </div>
      </section>
    </div>
  );
};

export default UserDashboard;
