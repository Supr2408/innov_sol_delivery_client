import React from "react";

const ItemModal = ({ isOpen, onClose, onSubmit, formData, onInputChange, editingId, loading }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0  bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white bg-opacity-95 backdrop-blur-md rounded-lg shadow-2xl max-w-2xl w-full max-h-96 overflow-y-auto border border-white border-opacity-20">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 bg-white bg-opacity-95 backdrop-blur-md">
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">
            {editingId ? "Edit Item" : "Add New Item"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold leading-none cursor-pointer transition-colors"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <form onSubmit={onSubmit} className="p-6">
          <div className="grid grid-cols-2 gap-4">
            <input
              type="text"
              name="itemName"
              placeholder="Item Name *"
              value={formData.itemName}
              onChange={onInputChange}
              className="border border-gray-300 p-2 sm:p-3 rounded col-span-1 sm:col-span-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <textarea
              name="description"
              placeholder="Description (optional) - Describe your product in detail"
              value={formData.description}
              onChange={onInputChange}
              rows="3"
              className="border border-gray-300 p-2 sm:p-3 rounded col-span-1 sm:col-span-2 text-sm sm:text-base resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              type="number"
              name="price"
              placeholder="Price *"
              value={formData.price}
              onChange={onInputChange}
              className="border border-gray-300 p-2 sm:p-3 rounded text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              step="0.01"
            />
            <input
              type="number"
              name="stock"
              placeholder="Stock *"
              value={formData.stock}
              onChange={onInputChange}
              className="border border-gray-300 p-2 sm:p-3 rounded text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              min="0"
            />
            <input
              type="text"
              name="category"
              placeholder="Category"
              value={formData.category}
              onChange={onInputChange}
              className="border border-gray-300 p-2 sm:p-3 rounded text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              type="text"
              name="sku"
              placeholder="SKU (Optional)"
              value={formData.sku}
              onChange={onInputChange}
              className="border border-gray-300 p-2 sm:p-3 rounded text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              type="text"
              name="image"
              placeholder="Image URL (Optional)"
              value={formData.image}
              onChange={onInputChange}
              className="border border-gray-300 p-2 sm:p-3 rounded col-span-1 sm:col-span-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              type="text"
              name="specifications"
              placeholder="Specifications (comma-separated, Optional)"
              value={
                Array.isArray(formData.specifications)
                  ? formData.specifications.join(", ")
                  : formData.specifications
              }
              onChange={(e) =>
                onInputChange({
                  target: {
                    name: "specifications",
                    value: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter((s) => s),
                  },
                })
              }
              className="border border-gray-300 p-2 sm:p-3 rounded col-span-1 sm:col-span-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Footer */}
          <div className="flex gap-3 mt-6 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 sm:px-6 py-2 sm:py-3 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 transition text-sm sm:text-base font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 sm:px-6 py-2 sm:py-3 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-400 transition text-sm sm:text-base font-medium cursor-pointer"
            >
              {loading ? "Saving..." : editingId ? "Update Item" : "Add Item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ItemModal;
