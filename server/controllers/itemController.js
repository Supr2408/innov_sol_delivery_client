import itemModel from "../models/itemModel.js";
import XLSX from "xlsx";

// Add single item with optional image and specifications
export const addItem = async (req, res) => {
  try {
    const { itemName, description, price, stock, category, sku, image, specifications } = req.body;
    const { storeId } = req.params;

    // validation
    if (!itemName || !price || stock === undefined) {
      return res
        .status(400)
        .json({ message: "Please provide item name, price, and stock" });
    }

    // check if item with same SKU already exists
    if (sku) {
      const existingItem = await itemModel.findOne({ sku });
      if (existingItem) {
        return res.status(400).json({ message: "Item with this SKU already exists" });
      }
    }

    const newItem = new itemModel({
      storeId,
      itemName,
      description,
      price,
      stock,
      category,
      sku,
      image: image || "",
      specifications: specifications || [],
    });

    await newItem.save();
    res.status(201).json({
      message: "Item added successfully",
      item: newItem,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all items for a store
export const getStoreItems = async (req, res) => {
  try {
    const { storeId } = req.params;

    const items = await itemModel.find({ storeId });
    res.status(200).json({
      message: "Items retrieved successfully",
      items,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update item with optional image and specifications
export const updateItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { itemName, description, price, stock, category, sku, image, specifications } = req.body;

    const item = await itemModel.findByIdAndUpdate(
      itemId,
      {
        itemName,
        description,
        price,
        stock,
        category,
        sku,
        image: image || "",
        specifications: specifications || [],
      },
      { new: true }
    );

    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    res.status(200).json({
      message: "Item updated successfully",
      item,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete item
export const deleteItem = async (req, res) => {
  try {
    const { itemId } = req.params;

    const item = await itemModel.findByIdAndDelete(itemId);

    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    res.status(200).json({
      message: "Item deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Import items from Excel
export const importItemsFromExcel = async (req, res) => {
  try {
    const { storeId } = req.params;

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Read Excel file
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    if (rawData.length === 0) {
      return res.status(400).json({ message: "Excel file is empty" });
    }

    // Flexible column mapping - accept various column names
    const normalizeHeaders = (row) => ({
      itemName:
        row["Item Name"] ||
        row.itemName ||
        row["item name"] ||
        row.name ||
        row.Name ||
        row.ITEM_NAME ||
        row["Product Name"] ||
        row.product ||
        "Unnamed Item",
      description:
        row.Description ||
        row.description ||
        row.desc ||
        row.Desc ||
        row["Product Description"] ||
        "",
      price:
        parseFloat(
          row.Price ||
            row.price ||
            row.PRICE ||
            row["Unit Price"] ||
            row.unitPrice ||
            0
        ) || 0,
      stock:
        parseInt(
          row.Stock ||
            row.stock ||
            row.STOCK ||
            row.Qty ||
            row.quantity ||
            row.Quantity ||
            0
        ) || 0,
      category:
        row.Category ||
        row.category ||
        row.CATEGORY ||
        row["Product Category"] ||
        "General",
      sku:
        row.SKU ||
        row.sku ||
        row.Sku ||
        row["Product SKU"] ||
        row.code ||
        row.Code ||
        null,
      image:
        row.Image ||
        row.image ||
        row.IMAGE ||
        row["Product Image"] ||
        row["Image URL"] ||
        row.imageUrl ||
        row["image url"] ||
        "",
      specifications:
        (row.Specifications || row.specifications || row.Specs || "")
          .split(",")
          .map((spec) => spec.trim())
          .filter((spec) => spec) || [],
    });

    // Process and deduplicate items
    const dedupedItems = new Map();
    const itemsToUpdate = [];
    const itemsToInsert = [];
    let successCount = 0;

    for (let i = 0; i < rawData.length; i++) {
      const normalizedRow = normalizeHeaders(rawData[i]);

      // Skip empty rows
      if (!normalizedRow.itemName || normalizedRow.itemName === "Unnamed Item") {
        continue;
      }

      const itemName = normalizedRow.itemName.toString().trim();
      const category = normalizedRow.category.toString().trim();
      const sku = normalizedRow.sku ? normalizedRow.sku.toString().trim() : null;
      const dedupeKey = sku
        ? `sku:${sku}`
        : `name:${itemName.toLowerCase()}|category:${category.toLowerCase()}`;

      if (dedupedItems.has(dedupeKey)) {
        const existingItem = dedupedItems.get(dedupeKey);
        existingItem.stock += normalizedRow.stock;
        dedupedItems.set(dedupeKey, existingItem);
        continue;
      }

      dedupedItems.set(dedupeKey, {
        storeId,
        itemName,
        description: normalizedRow.description.toString().trim(),
        price: normalizedRow.price,
        stock: normalizedRow.stock,
        category,
        sku,
        image: normalizedRow.image.toString().trim(),
        specifications: normalizedRow.specifications,
      });
    }

    if (dedupedItems.size === 0) {
      return res
        .status(400)
        .json({ message: "No valid items found in the file" });
    }

    // Check for existing items in database and update quantities instead of creating duplicates
    for (const itemToInsert of dedupedItems.values()) {
      const matchQuery = itemToInsert.sku
        ? { storeId, sku: itemToInsert.sku }
        : { storeId, itemName: itemToInsert.itemName, category: itemToInsert.category };

      const existingItem = await itemModel.findOne(matchQuery);

      if (existingItem) {
        // Item with same SKU already exists - update quantity
        itemsToUpdate.push(
          itemModel.findByIdAndUpdate(
            existingItem._id,
            {
              $inc: { stock: itemToInsert.stock }, // Increment stock
              $set: {
                itemName: itemToInsert.itemName,
                description: itemToInsert.description,
                price: itemToInsert.price,
                category: itemToInsert.category,
                image: itemToInsert.image,
                specifications: itemToInsert.specifications,
                ...(itemToInsert.sku ? { sku: itemToInsert.sku } : {}),
              },
            },
            { new: true }
          )
        );
      } else {
        // New item - prepare for insertion
        itemsToInsert.push(itemToInsert);
      }
    }

    // Execute updates
    const updatedItems = await Promise.all(itemsToUpdate);

    // Insert new items
    const insertedItems = itemsToInsert.length
      ? await itemModel.insertMany(itemsToInsert, { ordered: false })
      : [];

    successCount = updatedItems.length + insertedItems.length;

    res.status(201).json({
      message: `Import completed: ${successCount} items processed`,
      importedCount: successCount,
      newItems: insertedItems.length,
      updatedItems: updatedItems.length,
      items: [...updatedItems, ...insertedItems],
    });
  } catch (error) {
    console.error("Import error:", error);
    res.status(500).json({
      message:
        "Error processing file: " +
        (error.message || "Unknown error occurred"),
    });
  }
};

// Global search across all stores and items
export const globalSearch = async (req, res) => {
  try {
    const { query, category } = req.query;

    // Build search filter
    let filter = {};

    if (query && query.trim()) {
      filter.$or = [
        { itemName: { $regex: query, $options: "i" } },
        { description: { $regex: query, $options: "i" } },
        { category: { $regex: query, $options: "i" } },
        { specifications: { $regex: query, $options: "i" } },
      ];
    }

    if (category && category !== "All") {
      filter.category = category;
    }

    const items = await itemModel
      .find(filter)
      .populate("storeId", "storeName email phone address city")
      .sort({ createdAt: -1 })
      .limit(100);

    res.status(200).json({
      message: "Global search completed",
      items,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all unique categories
export const getAllCategories = async (req, res) => {
  try {
    const categories = await itemModel.distinct("category");
    res.status(200).json({
      message: "Categories retrieved successfully",
      categories: categories.sort(),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all unique specifications
export const getAllSpecifications = async (req, res) => {
  try {
    const items = await itemModel.find({ specifications: { $exists: true, $ne: [] } });
    const uniqueSpecs = new Set();
    
    items.forEach((item) => {
      if (item.specifications && Array.isArray(item.specifications)) {
        item.specifications.forEach((spec) => {
          uniqueSpecs.add(spec);
        });
      }
    });
    
    const specifications = Array.from(uniqueSpecs).sort();
    res.status(200).json({
      message: "Specifications retrieved successfully",
      specifications,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
