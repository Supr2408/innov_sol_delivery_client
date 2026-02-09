import React, { useContext, useEffect, useState } from "react";
import { AppContext } from "../../context/AppContext";
import axios from "axios";
import { toast } from "react-toastify";

const UserDashboard = () => {
  const { user } = useContext(AppContext);
  const [activeTab, setActiveTab] = useState("shop");
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [specifications, setSpecifications] = useState([]);
  const [selectedSpecification, setSelectedSpecification] = useState("All");
  const [cart, setCart] = useState([]);
  const [orders, setOrders] = useState([]);
  const [tracking, setTracking] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedItemDetails, setSelectedItemDetails] = useState(null);
  const [viewMode, setViewMode] = useState(2); // 1, 2, or "list"
  const [showProductModal, setShowProductModal] = useState(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem("userCart");
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("userCart", JSON.stringify(cart));
  }, [cart]);

  // Fetch stores and categories
  useEffect(() => {
    const fetchStores = async () => {
      try {
        setLoading(true);
        const { data } = await axios.get("/stores/all");
        setStores(data.stores || []);
      } catch (error) {
        toast.error("Failed to fetch stores");
      } finally {
        setLoading(false);
      }
    };

    const fetchCategories = async () => {
      try {
        const { data } = await axios.get("/items/categories/all");
        if (data.categories && Array.isArray(data.categories)) {
          setCategories(["All", ...data.categories]);
        } else {
          setCategories(["All"]);
        }
      } catch (error) {
        console.log("Failed to fetch categories:", error);
        setCategories(["All"]);
      }
    };

    const fetchSpecifications = async () => {
      try {
        const { data } = await axios.get("/items/specifications/all");
        if (data.specifications && Array.isArray(data.specifications)) {
          setSpecifications(["All", ...data.specifications]);
        } else {
          setSpecifications(["All"]);
        }
      } catch (error) {
        console.log("Failed to fetch specifications:", error);
        setSpecifications(["All"]);
      }
    };

    fetchStores();
    fetchCategories();
    fetchSpecifications();
  }, []);

  // Fetch items from selected store
  useEffect(() => {
    if (selectedStore && selectedStore !== "all") {
      fetchItems();
    }
  }, [selectedStore]);

  // Global search and filter logic
  useEffect(() => {
    if (selectedStore === "all") {
      // Global search across all stores
      if (selectedCategory !== "All") {
        // Category selected - browse by category
        performCategoryBrowse();
      } else if (searchQuery.trim()) {
        // Search query entered - search globally
        performGlobalSearch();
      } else {
        // No search query and "All" category selected
        setFilteredItems([]);
      }
    } else {
      // Search within selected store
      if (searchQuery.trim() === "") {
        filterByCategory(items);
      } else {
        const query = searchQuery.toLowerCase();
        const filtered = items.filter(
          (item) =>
            item.itemName.toLowerCase().includes(query) ||
            item.category.toLowerCase().includes(query) ||
            item.description.toLowerCase().includes(query) ||
            (item.specifications &&
              item.specifications.some((spec) =>
                spec.toLowerCase().includes(query)
              ))
        );
        filterByCategory(filtered);
      }
    }
  }, [searchQuery, items, selectedStore, selectedCategory, selectedSpecification]);

  // Filter items by category and specifications
  // Deduplicate items by SKU and filter out items with no stock
  const deduplicateItems = (itemsToFilter) => {
    const seen = new Set();
    return itemsToFilter.filter((item) => {
      const sku = item.sku || item._id; // Use SKU or fallback to _id
      // Only include items that are in stock and haven't been seen yet
      if (item.stock > 0 && !seen.has(sku)) {
        seen.add(sku);
        return true;
      }
      return false;
    });
  };

  const filterByCategory = (itemsToFilter) => {
    // First deduplicate items
    let deduped = deduplicateItems(itemsToFilter);
    let filtered = deduped;
    
    // Filter by category
    if (selectedCategory !== "All") {
      filtered = filtered.filter(
        (item) => item.category === selectedCategory
      );
    }
    
    // Filter by specification (partial match, case-insensitive)
    if (selectedSpecification.trim() !== "") {
      const specQuery = selectedSpecification.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.specifications &&
          item.specifications.some((spec) =>
            spec.toLowerCase().includes(specQuery)
          )
      );
    }
    
    setFilteredItems(filtered);
  };

  // Perform global search
  const performGlobalSearch = async () => {
    if (!searchQuery.trim()) {
      setFilteredItems([]);
      return;
    }

    try {
      setLoading(true);
      const query = new URLSearchParams({
        query: searchQuery,
        category: selectedCategory === "All" ? "" : selectedCategory,
      });
      const { data } = await axios.get(`/items/search/global?${query}`);
      // Apply deduplication and stock filtering to search results
      const deduped = deduplicateItems(data.items || []);
      setFilteredItems(deduped);
    } catch (error) {
      toast.error("Global search failed");
      setFilteredItems([]);
    } finally {
      setLoading(false);
    }
  };

  // Browse all items by category (no search term required)
  const performCategoryBrowse = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams({
        query: "", // Empty search query
        category: selectedCategory,
      });
      const { data } = await axios.get(`/items/search/global?${query}`);
      // Apply deduplication and stock filtering to category results
      const deduped = deduplicateItems(data.items || []);
      setFilteredItems(deduped);
    } catch (error) {
      console.log("Category browse failed:", error);
      setFilteredItems([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch items from store
  const fetchItems = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`/items/${selectedStore}`);
      setItems(data.items || []);
      filterByCategory(data.items || []);
    } catch (error) {
      toast.error("Failed to fetch items");
    } finally {
      setLoading(false);
    }
  };

  // Fetch user's orders
  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`/orders/user/${user.id}`);
      setOrders(data.orders || []);
    } catch (error) {
      toast.error("Failed to fetch orders");
    } finally {
      setLoading(false);
    }
  };

  // Fetch tracking info
  const fetchTracking = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`/orders/tracking/${user.id}`);
      setTracking(data.tracking || []);
    } catch (error) {
      // Tracking might not have orders yet, so don't show error
      setTracking([]);
    } finally {
      setLoading(false);
    }
  };

  // Add item to cart
  const addToCart = (item) => {
    const existingItem = cart.find((c) => c._id === item._id);
    if (existingItem) {
      setCart(
        cart.map((c) =>
          c._id === item._id ? { ...c, quantity: c.quantity + 1 } : c
        )
      );
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
    toast.success(`${item.itemName} added to cart!`);
  };

  // Update cart quantity
  const updateCartQuantity = (itemId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
    } else {
      setCart(
        cart.map((item) =>
          item._id === itemId ? { ...item, quantity } : item
        )
      );
    }
  };

  // Remove from cart
  const removeFromCart = (itemId) => {
    setCart(cart.filter((item) => item._id !== itemId));
    toast.info("Item removed from cart");
  };

  // Calculate cart totals
  const cartTotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const cartItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Extract first name
  const firstName = user?.name?.split(" ")[0];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center gap-2">
          <h1 className="text-lg sm:text-2xl font-bold truncate">Welcome, {firstName} 👋</h1>
          <button
            onClick={() => {
              setCartOpen(!cartOpen);
              setActiveTab("shop");
            }}
            className="relative bg-blue-500 text-white px-3 sm:px-4 py-2 rounded hover:bg-blue-600 transition cursor-pointer text-sm sm:text-base whitespace-nowrap"
          >
            🛒 ({cartItems})
          </button>
        </div>
      </div>

      {/* Tabs - Mobile Scrollable */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-4 sm:mt-6">
        <div className="flex gap-2 sm:gap-4 border-b mb-6 overflow-x-auto pb-2 sm:pb-0 flex-nowrap">
          <button
            onClick={() => {
              setActiveTab("shop");
              setCartOpen(false);
            }}
            className={`px-3 sm:px-6 py-2 sm:py-3 font-semibold border-b-2 transition cursor-pointer text-sm sm:text-base whitespace-nowrap ${
              activeTab === "shop"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            🛍️ Shop
          </button>
          <button
            onClick={() => {
              setActiveTab("orders");
              fetchOrders();
              setCartOpen(false);
            }}
            className={`px-3 sm:px-6 py-2 sm:py-3 font-semibold border-b-2 transition cursor-pointer text-sm sm:text-base whitespace-nowrap ${
              activeTab === "orders"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            📋 Orders
          </button>
          <button
            onClick={() => {
              setActiveTab("tracking");
              fetchTracking();
              setCartOpen(false);
            }}
            className={`px-3 sm:px-6 py-2 sm:py-3 font-semibold border-b-2 transition cursor-pointer text-sm sm:text-base whitespace-nowrap ${
              activeTab === "tracking"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            📍 Track
          </button>
        </div>

        {/* Loading or No Stores */}
        {loading && !stores.length && activeTab === "shop" && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
            <div className="text-center text-gray-500">
              <p className="mb-2">Loading your shops...</p>
              <p className="text-sm">Please wait while we fetch available stores.</p>
            </div>
          </div>
        )}

        {!loading && !stores.length && activeTab === "shop" && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
            <div className="text-center text-gray-500">
              <p className="mb-2">No stores available</p>
              <p className="text-sm">Sorry, there are no stores to browse right now. Please try again later.</p>
            </div>
          </div>
        )}

        {/* SHOP TAB */}
        {activeTab === "shop" && !cartOpen && stores.length > 0 && (
          <div>
            {/* Search Bar */}
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow mb-4 sm:mb-6">
              {/* Search Input */}
              <div className="mb-4">
                <input
                  type="text"
                  placeholder={
                    selectedStore === "all"
                      ? "Search all items, stores, categories..."
                      : "Search in selected store..."
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full border rounded px-3 sm:px-4 py-2 focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
              {/* Sidebar Filters - Hidden on Mobile */}
              <div className="hidden lg:block bg-white p-4 sm:p-6 rounded-lg shadow h-fit">
                <h3 className="text-lg font-semibold mb-4">Filters</h3>

                {/* Store Selection */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold mb-2">
                    Store
                  </label>
                  <select
                    value={selectedStore}
                    onChange={(e) => setSelectedStore(e.target.value)}
                    className="w-full border rounded px-3 py-2 cursor-pointer focus:outline-none focus:border-blue-500 text-sm"
                  >
                    <option value="all">🌐 All Stores</option>
                    {stores.map((store) => (
                      <option key={store._id} value={store._id}>
                        {store.storeName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Category Filter */}
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Category
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full border rounded px-3 py-2 cursor-pointer focus:outline-none focus:border-blue-500 text-sm"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Specifications Filter */}
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Specifications
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Organic, Roasted..."
                    value={selectedSpecification}
                    onChange={(e) => setSelectedSpecification(e.target.value)}
                    className="w-full border rounded px-3 py-2 focus:outline-none focus:border-blue-500 text-sm"
                  />
                </div>
              </div>

              {/* Mobile Filters */}
              <div className="lg:hidden bg-white p-4 rounded-lg shadow space-y-3 mb-4">
                <div>
                  <label className="text-xs font-semibold block mb-1">
                    Store
                  </label>
                  <select
                    value={selectedStore}
                    onChange={(e) => setSelectedStore(e.target.value)}
                    className="w-full border rounded px-3 py-2 cursor-pointer focus:outline-none focus:border-blue-500 text-sm"
                  >
                    <option value="all">🌐 All Stores</option>
                    {stores.map((store) => (
                      <option key={store._id} value={store._id}>
                        {store.storeName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">
                    Category
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full border rounded px-3 py-2 cursor-pointer focus:outline-none focus:border-blue-500 text-sm"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">
                    Specifications
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Organic, Roasted..."
                    value={selectedSpecification}
                    onChange={(e) => setSelectedSpecification(e.target.value)}
                    className="w-full border rounded px-3 py-2 focus:outline-none focus:border-blue-500 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Items Grid */}
            <div className="lg:col-span-3">
              {/* View Mode Toggle */}
              {filteredItems.length > 0 && (
                <div className="mb-4 flex gap-2 justify-end">
                  <button
                    onClick={() => setViewMode(1)}
                    className={`px-3 py-2 rounded text-sm font-medium whitespace-nowrap transition ${
                      viewMode === 1
                        ? "bg-blue-500 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    📱 Single
                  </button>
                  <button
                    onClick={() => setViewMode(2)}
                    className={`px-3 py-2 rounded text-sm font-medium whitespace-nowrap transition ${
                      viewMode === 2
                        ? "bg-blue-500 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    📊 2 Col
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`px-3 py-2 rounded text-sm font-medium whitespace-nowrap transition ${
                      viewMode === "list"
                        ? "bg-blue-500 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    📋 List
                  </button>
                </div>
              )}

              {loading && filteredItems.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  Loading items...
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  {selectedStore === "all" ? (
                    selectedCategory === "All" ? (
                      "Select a category or enter a search term to browse items"
                    ) : (
                      `No items found in ${selectedCategory} category`
                    )
                  ) : (
                    searchQuery ? "No items match your search" : "No items available"
                  )}
                </div>
              ) : viewMode === "list" ? (
                // List View
                <div className="space-y-3">
                  {filteredItems.map((item) => (
                    <div
                      key={item._id}
                      onClick={() => {
                        setSelectedItemDetails(item);
                        setShowProductModal(true);
                      }}
                      className="bg-white rounded-lg shadow hover:shadow-lg transition overflow-hidden cursor-pointer flex gap-4 p-4"
                    >
                      {/* Item Image */}
                      <div className="w-24 h-24 bg-gray-100 flex-shrink-0 flex items-center justify-center overflow-hidden rounded">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.itemName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="text-gray-400 text-center text-2xl">📦</div>
                        )}
                      </div>
                      {/* Item Details */}
                      <div className="flex-grow">
                        <h3 className="font-semibold text-base mb-1 line-clamp-1">
                          {item.itemName}
                        </h3>
                        <p className="text-xs text-gray-600 mb-1">{item.category}</p>
                        {selectedStore === "all" && item.storeId && (
                          <p className="text-xs text-blue-600 font-semibold mb-1">
                            {item.storeId.storeName}
                          </p>
                        )}
                        <p className="text-xs text-gray-700 mb-2 line-clamp-1">
                          {item.description}
                        </p>
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-bold text-blue-600">
                            ${item.price.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                // Grid View (1 or 2 columns)
                <div
                  className={`grid gap-3 sm:gap-4 ${
                    viewMode === 1
                      ? "grid-cols-1"
                      : "grid-cols-1 sm:grid-cols-2"
                  }`}
                >
                  {filteredItems.map((item) => (
                    <div
                      key={item._id}
                      onClick={() => {
                        setSelectedItemDetails(item);
                        setShowProductModal(true);
                      }}
                      className="bg-white rounded-lg shadow hover:shadow-lg transition overflow-hidden cursor-pointer"
                    >
                      {/* Item Image */}
                      <div className="h-40 bg-gray-100 flex items-center justify-center overflow-hidden">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.itemName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="text-gray-400 text-center">
                            <div className="text-4xl">📦</div>
                            <div className="text-sm">No Image</div>
                          </div>
                        )}
                      </div>

                      {/* Item Details */}
                      <div className="p-3 sm:p-4">
                        <h3 className="font-semibold text-base sm:text-lg mb-1 line-clamp-2">
                          {item.itemName}
                        </h3>
                        <p className="text-xs sm:text-sm text-gray-600 mb-1">
                          {item.category}
                        </p>

                        {/* Store name for All Stores view */}
                        {selectedStore === "all" && item.storeId && (
                          <p className="text-xs text-blue-600 font-semibold mb-1">
                            {item.storeId.storeName}
                          </p>
                        )}

                        <p className="text-xs sm:text-sm text-gray-700 mb-2 line-clamp-2">
                          {item.description}
                        </p>

                        {/* Specifications */}
                        {item.specifications && item.specifications.length > 0 && (
                          <div className="mb-2">
                            <p className="text-xs font-semibold text-gray-700 mb-1">
                              Specs:
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {item.specifications.map((spec, idx) => (
                                <span
                                  key={idx}
                                  className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs"
                                >
                                  {spec}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Price */}
                        <div className="mb-3 gap-2">
                          <span className="text-xl sm:text-2xl font-bold text-blue-600">
                            ${item.price.toFixed(2)}
                          </span>
                        </div>

                        {/* Add to Cart Button */}
                        <button
                          onClick={() => addToCart(item)}
                          disabled={item.stock === 0}
                          className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 transition disabled:bg-gray-400 disabled:cursor-not-allowed cursor-pointer text-sm sm:text-base font-medium"
                        >
                          🛒 Add to Cart
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* PRODUCT DETAIL MODAL */}
        {showProductModal && selectedItemDetails && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full my-8">
              {/* Header */}
              <div className="flex justify-between items-center p-6 border-b">
                <h2 className="text-2xl font-bold">{selectedItemDetails.itemName}</h2>
                <button
                  onClick={() => {
                    setShowProductModal(false);
                    setSelectedItemDetails(null);
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Content */}
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Image */}
                <div className="flex items-center justify-center bg-gray-100 rounded-lg overflow-hidden h-80 sm:h-96">
                  {selectedItemDetails.image ? (
                    <img
                      src={selectedItemDetails.image}
                      alt={selectedItemDetails.itemName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-gray-400 text-center">
                      <div className="text-6xl">📦</div>
                      <div className="text-sm mt-2">No Image Available</div>
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="space-y-4">
                  {/* Category & Store */}
                  <div>
                    <p className="text-sm text-gray-600">Category</p>
                    <p className="font-semibold text-lg">{selectedItemDetails.category}</p>
                  </div>

                  {selectedStore === "all" && selectedItemDetails.storeId && (
                    <div>
                      <p className="text-sm text-gray-600">Store</p>
                      <p className="font-semibold text-blue-600">
                        {selectedItemDetails.storeId.storeName}
                      </p>
                    </div>
                  )}

                  {/* Price */}
                  <div>
                    <p className="text-sm text-gray-600">Price</p>
                    <p className="text-3xl font-bold text-blue-600">
                      ${selectedItemDetails.price.toFixed(2)}
                    </p>
                  </div>

                  {/* Description */}
                  <div>
                    <p className="text-sm text-gray-600 font-semibold mb-2">Description</p>
                    <p className="text-gray-700 leading-relaxed">
                      {selectedItemDetails.description || "No description available"}
                    </p>
                  </div>

                  {/* Specifications */}
                  {selectedItemDetails.specifications &&
                    selectedItemDetails.specifications.length > 0 && (
                      <div>
                        <p className="text-sm text-gray-600 font-semibold mb-2">Specifications</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedItemDetails.specifications.map((spec, idx) => (
                            <span
                              key={idx}
                              className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded text-sm font-medium"
                            >
                              {spec}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Add to Cart Button */}
                  <button
                    onClick={() => {
                      addToCart(selectedItemDetails);
                      setShowProductModal(false);
                      setSelectedItemDetails(null);
                    }}
                    disabled={selectedItemDetails.stock === 0}
                    className="w-full bg-blue-500 text-white py-3 rounded font-semibold hover:bg-blue-600 transition disabled:bg-gray-400 disabled:cursor-not-allowed text-lg"
                  >
                    {selectedItemDetails.stock > 0 ? "🛒 Add to Cart" : "Out of Stock"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CART SIDEBAR */}
        {cartOpen && (
          <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl sm:text-2xl font-bold">Shopping Cart</h2>
              <button
                onClick={() => setCartOpen(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>

            {cart.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                Your cart is empty
              </div>
            ) : (
              <>
                {/* Cart Items */}
                <div className="space-y-3 mb-6 max-h-72 sm:max-h-96 overflow-y-auto">
                  {cart.map((item) => (
                    <div
                      key={item._id}
                      className="border rounded p-3 flex gap-3"
                    >
                      {item.image && (
                        <img
                          src={item.image}
                          alt={item.itemName}
                          className="w-14 h-14 sm:w-16 sm:h-16 rounded object-cover flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm sm:text-base line-clamp-1">
                          {item.itemName}
                        </h4>
                        <p className="text-xs sm:text-sm text-gray-600">
                          ${item.price.toFixed(2)} each
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={() =>
                              updateCartQuantity(item._id, item.quantity - 1)
                            }
                            className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 cursor-pointer text-sm"
                          >
                            −
                          </button>
                          <span className="w-6 text-center text-sm">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() =>
                              updateCartQuantity(item._id, item.quantity + 1)
                            }
                            className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 cursor-pointer text-sm"
                          >
                            +
                          </button>
                          <button
                            onClick={() => removeFromCart(item._id)}
                            className="ml-auto text-red-500 hover:text-red-700 font-semibold text-xs"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-sm sm:text-base">
                          ${(item.price * item.quantity).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Cart Summary */}
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between mb-4">
                    <span className="font-semibold text-base">Total:</span>
                    <span className="text-xl sm:text-2xl font-bold text-blue-600">
                      ${cartTotal.toFixed(2)}
                    </span>
                  </div>
                  <button className="w-full bg-green-500 text-white py-3 rounded hover:bg-green-600 transition cursor-pointer font-semibold text-sm sm:text-base">
                    Checkout
                  </button>
                  <button
                    onClick={() => setCartOpen(false)}
                    className="w-full bg-gray-300 text-gray-700 py-2 rounded hover:bg-gray-400 transition cursor-pointer text-sm sm:text-base"
                  >
                    Continue Shopping
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ORDER HISTORY TAB */}
        {activeTab === "orders" && (
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            {loading ? (
              <div className="text-center text-gray-500 py-8">
                Loading orders...
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                No orders yet. Start shopping!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm sm:text-base">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-2 sm:px-6 py-3 text-left text-xs sm:text-sm font-semibold">
                        Order ID
                      </th>
                      <th className="px-2 sm:px-6 py-3 text-left text-xs sm:text-sm font-semibold">
                        Date
                      </th>
                      <th className="px-2 sm:px-6 py-3 text-left text-xs sm:text-sm font-semibold">
                        Amount
                      </th>
                      <th className="px-2 sm:px-6 py-3 text-left text-xs sm:text-sm font-semibold">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {orders.map((order) => (
                      <tr key={order._id} className="hover:bg-gray-50">
                        <td className="px-2 sm:px-6 py-4 font-semibold text-xs sm:text-sm line-clamp-1">
                          {order.orderId}
                        </td>
                        <td className="px-2 sm:px-6 py-4 text-xs sm:text-sm">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-2 sm:px-6 py-4 font-semibold text-xs sm:text-sm">
                          ${order.totalAmount.toFixed(2)}
                        </td>
                        <td className="px-2 sm:px-6 py-4">
                          <span
                            className={`px-2 sm:px-3 py-1 rounded-full text-xs font-semibold ${
                              order.status === "delivered"
                                ? "bg-green-100 text-green-800"
                                : order.status === "shipped"
                                  ? "bg-blue-100 text-blue-800"
                                  : order.status === "in_transit"
                                    ? "bg-orange-100 text-orange-800"
                                    : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {order.status.replace(/_/g, " ")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TRACKING TAB */}
        {activeTab === "tracking" && (
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            {loading ? (
              <div className="text-center text-gray-500 py-8">
                Loading tracking info...
              </div>
            ) : tracking.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <div className="text-6xl mb-4">📍</div>
                No active deliveries. Place an order to track it!
              </div>
            ) : (
              <div className="space-y-4 sm:space-y-6">
                {tracking.map((delivery) => (
                  <div
                    key={delivery._id}
                    className="border rounded-lg p-4 sm:p-6 bg-gradient-to-r from-blue-50 to-purple-50"
                  >
                    <div className="flex justify-between items-start mb-4 gap-2">
                      <div className="min-w-0">
                        <h3 className="text-base sm:text-lg font-bold line-clamp-1">
                          {delivery.orderId}
                        </h3>
                        <p className="text-xs sm:text-sm text-gray-600 line-clamp-1">
                          Driver: {delivery.partnerName}
                        </p>
                      </div>
                      <span
                        className={`px-2 sm:px-4 py-1 rounded-full font-semibold text-xs sm:text-sm whitespace-nowrap flex-shrink-0 ${
                          delivery.status === "delivered"
                            ? "bg-green-100 text-green-800"
                            : delivery.status === "in_transit"
                              ? "bg-orange-100 text-orange-800"
                              : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {delivery.status.replace(/_/g, " ")}
                      </span>
                    </div>

                    {/* Timeline */}
                    <div className="space-y-3">
                      <div className="flex gap-3 sm:gap-4">
                        <div className="flex flex-col items-center flex-shrink-0">
                          <div
                            className={`w-4 h-4 rounded-full ${
                              delivery.status
                                ? "bg-blue-500"
                                : "bg-gray-300"
                            }`}
                          />
                          <div
                            className={`w-1 flex-grow ${
                              delivery.status
                                ? "bg-blue-500"
                                : "bg-gray-300"
                            }`}
                            style={{ minHeight: "40px" }}
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm sm:text-base">Order Confirmed</p>
                          <p className="text-xs sm:text-sm text-gray-600">
                            {new Date(delivery.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-3 sm:gap-4">
                        <div className="flex flex-col items-center flex-shrink-0">
                          <div
                            className={`w-4 h-4 rounded-full ${
                              delivery.status !== "pending"
                                ? "bg-blue-500"
                                : "bg-gray-300"
                            }`}
                          />
                          <div
                            className={`w-1 flex-grow ${
                              delivery.status === "delivered"
                                ? "bg-blue-500"
                                : "bg-gray-300"
                            }`}
                            style={{ minHeight: "40px" }}
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm sm:text-base">Out for Delivery</p>
                          <p className="text-xs sm:text-sm text-gray-600">
                            {delivery.status === "in_transit"
                              ? "Currently on the way"
                              : "Completed"}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-3 sm:gap-4">
                        <div className="flex flex-col items-center flex-shrink-0">
                          <div
                            className={`w-4 h-4 rounded-full ${
                              delivery.status === "delivered"
                                ? "bg-green-500"
                                : "bg-gray-300"
                            }`}
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm sm:text-base">Delivered</p>
                          <p className="text-xs sm:text-sm text-gray-600">
                            {delivery.status === "delivered"
                              ? "Order received"
                              : "Pending"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Delivery Info */}
                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-4 border-t text-sm sm:text-base">
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm text-gray-600">Delivery Address</p>
                        <p className="font-semibold line-clamp-2">
                          {delivery.deliveryAddress}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm text-gray-600">Amount</p>
                        <p className="font-semibold">
                          ${delivery.totalAmount.toFixed(2)}
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

export default UserDashboard;
