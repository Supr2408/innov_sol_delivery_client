import React, { useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { AppContext } from "../../context/appContext";

const AdminDashboard = () => {
  const { user } = useContext(AppContext);
  const [stores, setStores] = useState([]);
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        const [storesRes, itemsRes, categoriesRes] = await Promise.all([
          axios.get("/stores/all"),
          axios.get("/items/search/global?query=&category="),
          axios.get("/items/categories/all"),
        ]);

        setStores(storesRes.data.stores || []);
        setItems(itemsRes.data.items || []);
        setCategories(categoriesRes.data.categories || []);
      } catch {
        toast.error("Failed to load admin overview");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  const stats = useMemo(() => {
    const totalStores = stores.length;
    const totalItems = items.length;
    const totalCategories = categories.length;
    const lowStockItems = items.filter((item) => Number(item.stock) <= 5).length;

    return {
      totalStores,
      totalItems,
      totalCategories,
      lowStockItems,
    };
  }, [stores, items, categories]);

  const firstName = user?.name?.split(" ")[0];

  return (
    <div className="min-h-screen bg-gray-50 px-4 sm:px-6 py-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="bg-white rounded-xl shadow p-4 sm:p-6">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">
            Welcome back, {firstName || "Admin"}
          </h1>
          <p className="text-sm text-gray-500">
            System overview for stores, inventory, and operational risk.
          </p>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Stores", value: stats.totalStores },
            { label: "Total Items", value: stats.totalItems },
            { label: "Categories", value: stats.totalCategories },
            { label: "Low Stock Items", value: stats.lowStockItems },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl shadow p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">{stat.label}</p>
              <p className="text-2xl font-semibold text-gray-900 mt-2">
                {loading ? "--" : stat.value}
              </p>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white rounded-xl shadow p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Stores</h2>
              <span className="text-xs text-gray-500">Active onboarded stores</span>
            </div>

            {loading ? (
              <div className="text-sm text-gray-500">Loading stores...</div>
            ) : stores.length === 0 ? (
              <div className="text-sm text-gray-500">No stores registered yet.</div>
            ) : (
              <div className="space-y-3">
                {stores.slice(0, 6).map((store) => (
                  <div
                    key={store._id}
                    className="border border-gray-100 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 line-clamp-1">{store.storeName}</p>
                      <p className="text-xs text-gray-500 line-clamp-1">{store.email}</p>
                    </div>
                    <div className="text-xs text-gray-500">
                      {store.city || store.address || "No address on file"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Low Stock</h2>
              <span className="text-xs text-gray-500">Items at risk</span>
            </div>

            {loading ? (
              <div className="text-sm text-gray-500">Loading inventory...</div>
            ) : items.length === 0 ? (
              <div className="text-sm text-gray-500">No inventory found.</div>
            ) : (
              <div className="space-y-3">
                {items
                  .filter((item) => Number(item.stock) <= 5)
                  .slice(0, 6)
                  .map((item) => (
                    <div key={item._id} className="border border-gray-100 rounded-lg p-3">
                      <p className="font-medium text-gray-900 line-clamp-1">{item.itemName}</p>
                      <p className="text-xs text-gray-500">
                        Stock: {item.stock} | {item.storeId?.storeName || "Store"}
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminDashboard;
