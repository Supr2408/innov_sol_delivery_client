import React, { useContext, useEffect, useState } from "react";
import { AppContext } from "../../context/AppContext";
import axios from "axios";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import ItemModal from "../../components/ItemModal";
import { FiEdit2, FiTrash2 } from "react-icons/fi";

const StoreDashboard = () => {
  const { user } = useContext(AppContext);
  const [activeTab, setActiveTab] = useState("stock");
  const [items, setItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [partners, setPartners] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImportForm, setShowImportForm] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
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
    image: "",
    specifications: [],
  });

  const [editingId, setEditingId] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("All");

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
        image: "",
        specifications: [],
      });
      setShowItemModal(false);
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
      image: item.image || "",
      specifications: item.specifications || [],
    });
    setEditingId(item._id);
    setShowItemModal(true);
  };

  const handleDeleteItem = async (itemId) => {
    const result = await Swal.fire({
      title: "Delete Item?",
      text: "This action cannot be undone. Are you sure you want to delete this item?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, delete it!",
      cancelButtonText: "Cancel",
      customClass: {
        confirmButton: "cursor-pointer",
        cancelButton: "cursor-pointer",
      },
    });

    if (result.isConfirmed) {
      try {
        setLoading(true);
        await axios.delete(`/items/${itemId}`);
        toast.success("Item deleted successfully");
        fetchItems();
        Swal.fire("Deleted!", "Item has been deleted successfully.", "success");
      } catch (error) {
        toast.error("Failed to delete item");
        Swal.fire("Error!", "Failed to delete the item.", "error");
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
      [
        "Item Name",
        "Description",
        "Price",
        "Stock",
        "Category",
        "SKU",
        "Image",
      ],
      [
        "Laptop",
        "High-performance laptop",
        "999.99",
        "10",
        "Electronics",
        "LAP001",
        "https://example.com/laptop.jpg",
      ],
      [
        "Mouse",
        "Wireless mouse",
        "29.99",
        "50",
        "Accessories",
        "MOU001",
        "https://example.com/mouse.jpg",
      ],
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

  // Get unique categories from items
  const getCategories = () => {
    const categories = new Set(items.map((item) => item.category));
    return ["All", ...Array.from(categories).sort()];
  };

  // Filter items by selected category
  const getFilteredItems = () => {
    if (selectedCategory === "All") {
      return items;
    }
    return items.filter((item) => item.category === selectedCategory);
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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="p-4 sm:p-8 mb-4">
          <h1 className="text-xl sm:text-2xl font-semibold">
            Welcome, {firstName} 👋
          </h1>
        </div>

        {/* Tabs - Mobile Scrollable */}
        <div className="flex gap-2 sm:gap-4 mb-6 sm:mb-8 border-b overflow-x-auto pb-2 sm:pb-0 flex-nowrap">
          <button
            onClick={() => setActiveTab("stock")}
            className={`px-3 sm:px-6 py-2 sm:py-3 font-semibold border-b-2 transition cursor-pointer text-sm sm:text-base whitespace-nowrap ${
              activeTab === "stock"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            📦 Stock
          </button>
          <button
            onClick={() => setActiveTab("orders")}
            className={`px-3 sm:px-6 py-2 sm:py-3 font-semibold border-b-2 transition cursor-pointer text-sm sm:text-base whitespace-nowrap ${
              activeTab === "orders"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            📋 Orders
          </button>
          <button
            onClick={() => setActiveTab("deliveries")}
            className={`px-3 sm:px-6 py-2 sm:py-3 font-semibold border-b-2 transition cursor-pointer text-sm sm:text-base whitespace-nowrap ${
              activeTab === "deliveries"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            🚗 Delivery
          </button>
        </div>

        {/* STOCK MANAGEMENT TAB */}
        {activeTab === "stock" && (
          <div>
            <div className="flex gap-2 sm:gap-4 mb-6 sm:mb-8 items-center flex-wrap">
              <button
                onClick={() => {
                  setShowItemModal(true);
                  setEditingId(null);
                  setFormData({
                    itemName: "",
                    description: "",
                    price: "",
                    stock: "",
                    category: "General",
                    sku: "",
                    image: "",
                    specifications: [],
                  });
                }}
                className="bg-blue-500 text-white px-3 sm:px-6 py-2 rounded hover:bg-blue-600 transition cursor-pointer text-sm sm:text-base font-medium"
              >
                + Add Item
              </button>
              <button
                onClick={() => setShowImportForm(!showImportForm)}
                className="bg-green-500 text-white px-3 sm:px-6 py-2 rounded hover:bg-green-600 transition cursor-pointer text-sm sm:text-base font-medium"
              >
                {showImportForm ? "Cancel" : "📥 Import"}
              </button>

              {/* Category Filter Dropdown */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="border border-gray-300 rounded px-2 sm:px-4 py-2 focus:outline-none focus:border-blue-500 bg-white cursor-pointer text-sm sm:text-base"
              >
                {getCategories().map((category) => (
                  <option key={category} value={category}>
                    {category === "All"
                      ? "📂 All"
                      : `📁 ${category}`}
                  </option>
                ))}
              </select>

              {/* Category badge showing current selection */}
              {selectedCategory !== "All" && (
                <div className="bg-blue-100 text-blue-800 px-2 sm:px-4 py-1 sm:py-2 rounded-full text-xs sm:text-sm font-semibold flex items-center gap-1 flex-shrink-0">
                  <span className="line-clamp-1">{selectedCategory}</span>
                  <button
                    onClick={() => setSelectedCategory("All")}
                    className="text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            {/* Item Modal */}
            <ItemModal
              isOpen={showItemModal}
              onClose={() => setShowItemModal(false)}
              onSubmit={handleAddItem}
              formData={formData}
              onInputChange={handleInputChange}
              editingId={editingId}
              loading={loading}
            />

            {/* Import Form */}
            {showImportForm && (
              <div className="bg-white p-4 sm:p-6 rounded-lg shadow mb-6 sm:mb-8">
                <h2 className="text-lg sm:text-xl font-semibold mb-4">
                  Import Items from Excel
                </h2>
                <div className="space-y-3 sm:space-y-4">
                  <div className="bg-blue-50 p-3 sm:p-4 rounded border border-blue-200">
                    <h3 className="font-semibold text-blue-900 mb-2 text-sm sm:text-base">
                      📋 Supported Column Names:
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm text-blue-800">
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
                      <div>
                        <strong>Image:</strong> Image, image, Image URL, imageUrl
                        (optional)
                      </div>
                    </div>
                  </div>

                  <p className="text-gray-600 text-xs sm:text-sm">
                    ✅ System will auto-generate SKU if not provided
                  </p>
                  <p className="text-gray-600 text-xs sm:text-sm">
                    ✅ Works with any Excel format (XLSX, XLS, CSV)
                  </p>
                  <p className="text-gray-600 text-xs sm:text-sm">
                    ✅ Duplicates will be handled automatically
                  </p>

                  <button
                    onClick={downloadTemplate}
                    className="bg-green-500 text-white px-3 sm:px-6 py-2 rounded hover:bg-green-600 transition cursor-pointer text-sm sm:text-base font-medium w-full sm:w-auto"
                  >
                    📥 Download Template
                  </button>

                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv,.ods"
                    onChange={handleFileUpload}
                    disabled={loading}
                    className="border p-2 sm:p-3 rounded w-full cursor-pointer text-sm"
                  />

                  {loading && (
                    <div className="text-center text-blue-500 text-sm">
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
                  <div className="p-4 sm:p-6 text-center text-gray-500 text-sm sm:text-base">
                    Loading items...
                  </div>
                ) : items.length === 0 ? (
                  <div className="p-4 sm:p-6 text-center text-gray-500 text-sm sm:text-base">
                    No items added yet
                  </div>
                ) : getFilteredItems().length === 0 ? (
                  <div className="p-4 sm:p-6 text-center text-gray-500 text-sm sm:text-base">
                    No items in "{selectedCategory}" category
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-900">
                          Image
                        </th>
                        <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-900">
                          Item Name
                        </th>
                        <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-900">
                          Category
                        </th>
                        <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-900">
                          Price
                        </th>
                        <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-900">
                          Stock
                        </th>
                        <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-900">
                          SKU
                        </th>
                        <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-900">
                          Description
                        </th>
                        <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-900">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {getFilteredItems().map((item) => (
                        <tr key={item._id} className="hover:bg-gray-50">
                          <td className="px-2 sm:px-6 py-2 sm:py-4 text-sm">
                            {item.image ? (
                              <img
                                src={item.image}
                                alt={item.itemName}
                                className="h-10 w-10 sm:h-12 sm:w-12 rounded object-cover border"
                              />
                            ) : (
                              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded bg-gray-200 flex items-center justify-center text-xs text-gray-500">
                                No img
                              </div>
                            )}
                          </td>
                          <td className="px-2 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm text-gray-900">
                            <span className="line-clamp-1">{item.itemName}</span>
                          </td>
                          <td className="px-2 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm text-gray-600">
                            <span className="line-clamp-1">{item.category}</span>
                          </td>
                          <td className="px-2 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm font-semibold text-gray-900">
                            ${item.price.toFixed(2)}
                          </td>
                          <td className="px-2 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm">
                            {editStockId === item._id ? (
                              <div className="flex gap-1 sm:gap-2 flex-wrap">
                                <input
                                  type="number"
                                  value={editStockValue}
                                  onChange={(e) =>
                                    setEditStockValue(e.target.value)
                                  }
                                  className="border p-1 rounded w-14 sm:w-16 text-xs"
                                  autoFocus
                                />
                                <button
                                  onClick={() =>
                                    handleUpdateStock(item._id, editStockValue)
                                  }
                                  className="bg-green-500 text-white px-2 py-1 rounded text-xs whitespace-nowrap"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditStockId(null)}
                                  className="bg-gray-400 text-white px-2 py-1 rounded text-xs whitespace-nowrap"
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
                                className={`inline-block px-2 sm:px-3 py-1 rounded-full text-xs font-semibold cursor-pointer whitespace-nowrap ${getStockColor(
                                  item.stock,
                                )}`}
                              >
                                {item.stock} units
                              </div>
                            )}
                          </td>
                          <td className="px-2 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm text-gray-600">
                            <span className="line-clamp-1">{item.sku || "-"}</span>
                          </td>
                          <td className="px-2 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm text-gray-600">
                            <span className="line-clamp-2" title={item.description}>
                              {item.description || "No description"}
                            </span>
                          </td>
                          <td className="px-2 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm space-x-1 sm:space-x-2 flex flex-nowrap items-center">
                            <button
                              onClick={() => handleEditItem(item)}
                              className="text-blue-500 hover:text-blue-700 transition cursor-pointer p-1.5 rounded hover:bg-blue-50 flex items-center justify-center"
                              title="Edit item"
                            >
                              <FiEdit2 size={18} />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item._id)}
                              className="text-red-500 hover:text-red-700 transition cursor-pointer p-1.5 rounded hover:bg-red-50 flex items-center justify-center"
                              title="Delete item"
                            >
                              <FiTrash2 size={18} />
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
            <div className="p-4 sm:p-6">
              {loading ? (
                <div className="text-center text-gray-500 text-sm">
                  Loading orders...
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center text-gray-500 py-8 text-sm">
                  No orders yet
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold">
                          Order ID
                        </th>
                        <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold">
                          Client
                        </th>
                        <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold">
                          Amount
                        </th>
                        <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold">
                          Status
                        </th>
                        <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold">
                          Partner
                        </th>
                        <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold">
                          Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {orders.map((order) => (
                        <tr key={order._id} className="hover:bg-gray-50">
                          <td className="px-2 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm font-medium text-gray-900">
                            <span className="line-clamp-1">{order.orderId}</span>
                          </td>
                          <td className="px-2 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm text-gray-600">
                            <span className="line-clamp-1">{order.clientName}</span>
                          </td>
                          <td className="px-2 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm font-semibold">
                            ${order.totalAmount.toFixed(2)}
                          </td>
                          <td className="px-2 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm">
                            <span
                              className={`px-2 sm:px-3 py-1 rounded-full text-xs font-semibold inline-block whitespace-nowrap ${getStatusColor(order.status)}`}
                            >
                              {order.status.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="px-2 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm text-gray-600">
                            <span className="line-clamp-1">{order.partnerName || "Unassigned"}</span>
                          </td>
                          <td className="px-2 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm text-gray-600">
                            <span className="line-clamp-1">{new Date(order.createdAt).toLocaleDateString()}</span>
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
              <div className="text-center text-gray-500 py-8 text-sm">
                Loading partners...
              </div>
            ) : partners.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-4 sm:p-6 text-center text-gray-500 text-sm">
                No delivery partners yet
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {partners.map((partner) => (
                  <div
                    key={partner.id}
                    className="bg-white rounded-lg shadow p-4 sm:p-6"
                  >
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                      {partner.name}
                    </h3>
                    <div className="space-y-1 sm:space-y-2 text-xs sm:text-sm text-gray-600">
                      <p>
                        <strong>📞 Phone:</strong> <span className="line-clamp-1">{partner.phone}</span>
                      </p>
                      <p>
                        <strong>📧 Email:</strong> <span className="line-clamp-1">{partner.email}</span>
                      </p>
                      <p>
                        <strong>🚗 Vehicle:</strong> <span className="line-clamp-1">{partner.vehicle}</span>
                      </p>
                      <div className="border-t pt-2 sm:pt-3 mt-2 sm:mt-3">
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
