import React, { useContext, useEffect, useState } from "react";
import { AppContext } from "../../context/AppContext";
import axios from "axios";
import { toast } from "react-toastify";

const StoreDashboard = () => {
  const { user } = useContext(AppContext);
  const [activeTab, setActiveTab] = useState("stock");
  const [items, setItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [partners, setPartners] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImportForm, setShowImportForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editStockId, setEditStockId] = useState(null);
  const [editStockValue, setEditStockValue] = useState("");

  const [formData, setFormData] = useState({
    itemName: "",
    description: "",
    price: "",
    stock: "",
    category: "General",
    sku: "",
  });

  const [editingId, setEditingId] = useState(null);

  // Fetch data based on active tab
  useEffect(() => {
    if (user?.id) {
      if (activeTab === "stock") {
        fetchItems();
      } else if (activeTab === "orders") {
        fetchOrders();
      } else if (activeTab === "deliveries") {
        fetchPartners();
      }
    }
  }, [user, activeTab]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`/items/${user.id}`);
      setItems(data.items || []);
    } catch (error) {
      toast.error("Failed to fetch items");
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`/orders/${user.id}`);
      setOrders(data.orders || []);
    } catch (error) {
      toast.error("Failed to fetch orders");
    } finally {
      setLoading(false);
    }
  };

  const fetchPartners = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`/orders/partners/${user.id}`);
      setPartners(data.partners || []);
    } catch (error) {
      toast.error("Failed to fetch delivery partners");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAddItem = async (e) => {
    e.preventDefault();

    if (!formData.itemName || !formData.price || formData.stock === "") {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setLoading(true);
      if (editingId) {
        // Update item
        await axios.put(`/items/${editingId}`, formData);
        toast.success("Item updated successfully");
        setEditingId(null);
      } else {
        // Add new item
        await axios.post(`/items/add/${user.id}`, formData);
        toast.success("Item added successfully");
      }

      setFormData({
        itemName: "",
        description: "",
        price: "",
        stock: "",
        category: "General",
        sku: "",
      });
      setShowAddForm(false);
      fetchItems();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save item");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStock = async (itemId, newStock) => {
    try {
      setLoading(true);
      const item = items.find((i) => i._id === itemId);
      await axios.put(`/items/${itemId}`, {
        ...item,
        stock: parseInt(newStock),
      });
      toast.success("Stock updated successfully");
      setEditStockId(null);
      setEditStockValue("");
      fetchItems();
    } catch (error) {
      toast.error("Failed to update stock");
    } finally {
      setLoading(false);
    }
  };

  const handleEditItem = (item) => {
    setFormData({
      itemName: item.itemName,
      description: item.description,
      price: item.price,
      stock: item.stock,
      category: item.category,
      sku: item.sku || "",
    });
    setEditingId(item._id);
    setShowAddForm(true);
  };

  const handleDeleteItem = async (itemId) => {
    if (window.confirm("Are you sure you want to delete this item?")) {
      try {
        setLoading(true);
        await axios.delete(`/items/${itemId}`);
        toast.success("Item deleted successfully");
        fetchItems();
      } catch (error) {
        toast.error("Failed to delete item");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setLoading(true);
      const formDataObj = new FormData();
      formDataObj.append("file", file);

      const { data } = await axios.post(
        `/items/import/${user.id}`,
        formDataObj,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );

      toast.success(`${data.importedCount} items imported successfully`);
      setShowImportForm(false);
      fetchItems();
    } catch (error) {
      const errorMsg =
        error.response?.data?.message || "Failed to import items";
      toast.error(errorMsg);
      // Show partial success message if applicable
      if (error.response?.status === 207) {
        toast.info(
          `${error.response?.data?.failedCount} items had issues but some were imported`,
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const templateData = [
      ["Item Name", "Description", "Price", "Stock", "Category", "SKU"],
      [
        "Laptop",
        "High-performance laptop",
        "999.99",
        "10",
        "Electronics",
        "LAP001",
      ],
      ["Mouse", "Wireless mouse", "29.99", "50", "Accessories", "MOU001"],
    ];

    const csv = templateData.map((row) => row.join(",")).join("\n");

    const element = document.createElement("a");
    element.setAttribute(
      "href",
      "data:text/csv;charset=utf-8," + encodeURIComponent(csv),
    );
    element.setAttribute("download", "store_items_template.csv");
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "delivered":
        return "bg-green-100 text-green-800";
      case "shipped":
        return "bg-blue-100 text-blue-800";
      case "in_transit":
        return "bg-orange-100 text-orange-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStockColor = (stock) => {
    if (stock > 20) return "bg-green-100 text-green-800";
    if (stock > 10) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  const firstName = user?.storeName?.split(" ")[0];

  if (!user || !user.id) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading dashboard...
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="p-8">
          <h1 className="text-2xl font-semibold mb-6">
            Welcome, {firstName} 👋
          </h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b">
          <button
            onClick={() => setActiveTab("stock")}
            className={`px-6 py-3 font-semibold border-b-2 transition cursor-pointer ${
              activeTab === "stock"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            📦 Stock Management
          </button>
          <button
            onClick={() => setActiveTab("orders")}
            className={`px-6 py-3 font-semibold border-b-2 transition cursor-pointer ${
              activeTab === "orders"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            📋 Orders
          </button>
          <button
            onClick={() => setActiveTab("deliveries")}
            className={`px-6 py-3 font-semibold border-b-2 transition cursor-pointer ${
              activeTab === "deliveries"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            🚗 Delivery Partners
          </button>
        </div>

        {/* STOCK MANAGEMENT TAB */}
        {activeTab === "stock" && (
          <div>
            <div className="flex gap-4 mb-8">
              <button
                onClick={() => {
                  setShowAddForm(!showAddForm);
                  setEditingId(null);
                  setFormData({
                    itemName: "",
                    description: "",
                    price: "",
                    stock: "",
                    category: "General",
                    sku: "",
                  });
                }}
                className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 transition cursor-pointer"
              >
                {showAddForm ? "Cancel" : "+ Add Item"}
              </button>
              <button
                onClick={() => setShowImportForm(!showImportForm)}
                className="bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600 transition cursor-pointer"
              >
                {showImportForm ? "Cancel" : "📥 Import Excel"}
              </button>
            </div>

            {/* Add Item Form */}
            {showAddForm && (
              <div className="bg-white p-6 rounded-lg shadow mb-8">
                <h2 className="text-xl font-semibold mb-4">
                  {editingId ? "Edit Item" : "Add New Item"}
                </h2>
                <form
                  onSubmit={handleAddItem}
                  className="grid grid-cols-2 gap-4"
                >
                  <input
                    type="text"
                    name="itemName"
                    placeholder="Item Name *"
                    value={formData.itemName}
                    onChange={handleInputChange}
                    className="border p-2 rounded col-span-2"
                    required
                  />
                  <input
                    type="text"
                    name="description"
                    placeholder="Description"
                    value={formData.description}
                    onChange={handleInputChange}
                    className="border p-2 rounded"
                  />
                  <input
                    type="number"
                    name="price"
                    placeholder="Price *"
                    value={formData.price}
                    onChange={handleInputChange}
                    className="border p-2 rounded"
                    required
                  />
                  <input
                    type="number"
                    name="stock"
                    placeholder="Stock *"
                    value={formData.stock}
                    onChange={handleInputChange}
                    className="border p-2 rounded"
                    required
                  />
                  <input
                    type="text"
                    name="category"
                    placeholder="Category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className="border p-2 rounded"
                  />
                  <input
                    type="text"
                    name="sku"
                    placeholder="SKU (Optional)"
                    value={formData.sku}
                    onChange={handleInputChange}
                    className="border p-2 rounded"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="col-span-2 bg-blue-500 text-white p-2 rounded hover:bg-blue-600 disabled:bg-gray-400 transition cursor-pointer"
                  >
                    {loading
                      ? "Saving..."
                      : editingId
                        ? "Update Item"
                        : "Add Item"}
                  </button>
                </form>
              </div>
            )}

            {/* Import Form */}
            {showImportForm && (
              <div className="bg-white p-6 rounded-lg shadow mb-8">
                <h2 className="text-xl font-semibold mb-4">
                  Import Items from Excel
                </h2>
                <div className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded border border-blue-200">
                    <h3 className="font-semibold text-blue-900 mb-2">
                      📋 Supported Column Names:
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-sm text-blue-800">
                      <div>
                        <strong>Item Name:</strong> Item Name, itemName, name,
                        Product Name
                      </div>
                      <div>
                        <strong>Price:</strong> Price, price, Unit Price,
                        unitPrice
                      </div>
                      <div>
                        <strong>Stock:</strong> Stock, stock, Qty, quantity,
                        Quantity
                      </div>
                      <div>
                        <strong>Category:</strong> Category, category, Product
                        Category
                      </div>
                      <div>
                        <strong>Description:</strong> Description, description,
                        desc, Product Description
                      </div>
                      <div>
                        <strong>SKU:</strong> SKU, sku, code, Product SKU
                        (optional)
                      </div>
                    </div>
                  </div>

                  <p className="text-gray-600 text-sm">
                    ✅ System will auto-generate SKU if not provided
                  </p>
                  <p className="text-gray-600 text-sm">
                    ✅ Works with any Excel format (XLSX, XLS, CSV)
                  </p>
                  <p className="text-gray-600 text-sm">
                    ✅ Duplicates will be handled automatically
                  </p>

                  <button
                    onClick={downloadTemplate}
                    className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition cursor-pointer"
                  >
                    📥 Download Template CSV
                  </button>

                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv,.ods"
                    onChange={handleFileUpload}
                    disabled={loading}
                    className="border p-2 rounded w-full cursor-pointer"
                  />

                  {loading && (
                    <div className="text-center text-blue-500">
                      Importing items... Please wait
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Items Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                {loading && items.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    Loading items...
                  </div>
                ) : items.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    No items added yet
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                          Item Name
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                          Category
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                          Price
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                          Stock
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                          SKU
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {items.map((item) => (
                        <tr key={item._id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {item.itemName}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {item.category}
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                            ${item.price.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {editStockId === item._id ? (
                              <div className="flex gap-2">
                                <input
                                  type="number"
                                  value={editStockValue}
                                  onChange={(e) =>
                                    setEditStockValue(e.target.value)
                                  }
                                  className="border p-1 rounded w-16"
                                  autoFocus
                                />
                                <button
                                  onClick={() =>
                                    handleUpdateStock(item._id, editStockValue)
                                  }
                                  className="bg-green-500 text-white px-2 py-1 rounded text-xs"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditStockId(null)}
                                  className="bg-gray-400 text-white px-2 py-1 rounded text-xs"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div
                                onClick={() => {
                                  setEditStockId(item._id);
                                  setEditStockValue(item.stock);
                                }}
                                className={`inline-block px-3 py-1 rounded-full text-xs font-semibold cursor-pointer ${getStockColor(
                                  item.stock,
                                )}`}
                              >
                                {item.stock} units
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {item.sku || "-"}
                          </td>
                          <td className="px-6 py-4 text-sm space-x-2">
                            <button
                              onClick={() => handleEditItem(item)}
                              className="text-blue-500 hover:text-blue-700 font-semibold"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item._id)}
                              className="text-red-500 hover:text-red-700 font-semibold"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ORDERS TAB */}
        {activeTab === "orders" && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6">
              {loading ? (
                <div className="text-center text-gray-500">
                  Loading orders...
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  No orders yet
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-6 py-3 text-left text-sm font-semibold">
                          Order ID
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-semibold">
                          Client
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-semibold">
                          Amount
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-semibold">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-semibold">
                          Partner
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-semibold">
                          Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {orders.map((order) => (
                        <tr key={order._id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">
                            {order.orderId}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {order.clientName}
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold">
                            ${order.totalAmount.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(order.status)}`}
                            >
                              {order.status.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {order.partnerName || "Unassigned"}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {new Date(order.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* DELIVERY PARTNERS TAB */}
        {activeTab === "deliveries" && (
          <div>
            {loading ? (
              <div className="text-center text-gray-500 py-8">
                Loading partners...
              </div>
            ) : partners.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
                No delivery partners yet
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {partners.map((partner) => (
                  <div
                    key={partner.id}
                    className="bg-white rounded-lg shadow p-6"
                  >
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {partner.name}
                    </h3>
                    <div className="space-y-2 text-sm text-gray-600">
                      <p>
                        <strong>📞 Phone:</strong> {partner.phone}
                      </p>
                      <p>
                        <strong>📧 Email:</strong> {partner.email}
                      </p>
                      <p>
                        <strong>🚗 Vehicle:</strong> {partner.vehicle}
                      </p>
                      <div className="border-t pt-3 mt-3">
                        <p className="font-semibold text-gray-900">
                          Total Deliveries:{" "}
                          <span className="text-blue-600">
                            {partner.totalDeliveries}
                          </span>
                        </p>
                        <p className="font-semibold text-gray-900">
                          Total Amount:{" "}
                          <span className="text-green-600">
                            ${partner.totalAmount.toFixed(2)}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StoreDashboard;
