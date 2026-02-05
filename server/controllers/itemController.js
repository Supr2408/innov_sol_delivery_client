import itemModel from "../models/itemModel.js";
import XLSX from "xlsx";

// Add single item
export const addItem = async (req, res) => {
  try {
    const { itemName, description, price, stock, category, sku } = req.body;
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

// Update item
export const updateItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { itemName, description, price, stock, category, sku } = req.body;

    const item = await itemModel.findByIdAndUpdate(
      itemId,
      {
        itemName,
        description,
        price,
        stock,
        category,
        sku,
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
    });

    // Process and deduplicate items
    const skuSet = new Set();
    const itemsToInsert = [];

    for (let i = 0; i < rawData.length; i++) {
      const normalizedRow = normalizeHeaders(rawData[i]);

      // Skip empty rows
      if (!normalizedRow.itemName || normalizedRow.itemName === "Unnamed Item") {
        continue;
      }

      // Generate unique SKU if not provided
      let sku = normalizedRow.sku;
      if (!sku) {
        sku = `SKU-${storeId}-${Date.now()}-${i}`;
      }

      // Check for duplicates within the file
      if (skuSet.has(sku)) {
        // Generate unique SKU for duplicate
        sku = `${sku}-${i}`;
      }

      skuSet.add(sku);

      itemsToInsert.push({
        storeId,
        itemName: normalizedRow.itemName.toString().trim(),
        description: normalizedRow.description.toString().trim(),
        price: normalizedRow.price,
        stock: normalizedRow.stock,
        category: normalizedRow.category.toString().trim(),
        sku: sku,
      });
    }

    if (itemsToInsert.length === 0) {
      return res
        .status(400)
        .json({ message: "No valid items found in the file" });
    }

    // Insert items with ordered: false to allow partial success
    try {
      const result = await itemModel.insertMany(itemsToInsert, {
        ordered: false,
      });

      res.status(201).json({
        message: `${result.length} items imported successfully`,
        importedCount: result.length,
        totalRows: itemsToInsert.length,
        items: result,
      });
    } catch (insertError) {
      // If there are write errors, still return successful items
      if (insertError.writeErrors && insertError.writeErrors.length > 0) {
        const successCount = insertError.insertedIds ? insertError.insertedIds.length : 0;
        res.status(207).json({
          message: `${successCount} items imported successfully. ${insertError.writeErrors.length} items failed due to duplicate SKU.`,
          importedCount: successCount,
          failedCount: insertError.writeErrors.length,
          errors: insertError.writeErrors.map((err) => ({
            index: err.index,
            message: err.error.message,
          })),
        });
      } else {
        throw insertError;
      }
    }
  } catch (error) {
    console.error("Import error:", error);
    res.status(500).json({
      message:
        "Error processing file: " +
        (error.message || "Unknown error occurred"),
    });
  }
};
