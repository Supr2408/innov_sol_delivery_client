# Feature Implementation Guide - Visual Overview

## 1. Global Search vs Store Search

### Store Search Mode (Default)
```
┌─────────────────────────────────────────┐
│  🏪 Store Search  │ 🔍 Global Search   │  ← Toggle buttons
├─────────────────────────────────────────┤
│ Search in selected store...             │  ← Search input
└─────────────────────────────────────────┘

┌────────────────────┬─────────────────────────────────┐
│  FILTERS (Desktop) │  ITEMS GRID                     │
├────────────────────┤                                 │
│ Store Dropdown     │  ┌──────────┐  ┌──────────┐   │
│ Category Dropdown  │  │  Item 1  │  │  Item 2  │   │
│                    │  │ + Specs  │  │ + Specs  │   │
│                    │  └──────────┘  └──────────┘   │
└────────────────────┴─────────────────────────────────┘

Results: Filtered by selected store + category
```

### Global Search Mode
```
┌─────────────────────────────────────────┐
│  🏪 Store Search  │ 🔍 Global Search   │  ← Toggle buttons
├─────────────────────────────────────────┤
│ Search all items, stores, categories... │  ← Global search input
└─────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│  FILTERS (Desktop) │  ITEMS GRID               │
├──────────────────────────────────────────────────┤
│ Category Filter   │  ┌────────────────┐        │
│ (All, Groceries,  │  │  Item 1        │        │
│  Electronics...)  │  │  Store: ABC    │        │
│                   │  │  + Specs       │        │
│                   │  └────────────────┘        │
└──────────────────────────────────────────────────┘

Results: From ALL stores (if no category) or matching category
```

---

## 2. Categories Filter Flow

```
                    ┌─────────────────────┐
                    │ GET /categories/all │
                    └──────────┬──────────┘
                               │
                        Categories: [
                          "All",
                          "Groceries",
                          "Electronics",
                          "Health",
                          "Clothing"
                        ]
                               │
                    ┌──────────▼──────────┐
                    │ Populate Dropdown   │
                    └──────────┬──────────┘
                               │
                    User selects "Groceries"
                               │
                    ┌──────────▼──────────┐
                    │ Filter Results      │
                    │ (Store or Global)   │
                    └──────────┬──────────┘
                               │
                        Display matching items
```

---

## 3. Item Specifications Data Flow

### Adding Specifications
```
┌──────────────────────────────────────────┐
│ Specifications Input Field               │
│ "100g, Premium, Organic"                 │
└────────────┬─────────────────────────────┘
             │
             ▼
    handleInputChange()
    .split(",").map(s => s.trim())
             │
             ▼
    formData.specifications = [
      "100g",
      "Premium",
      "Organic"
    ]
             │
             ▼
    POST /items/add/:storeId
             │
             ▼
    Database saves as array
```

### Displaying Specifications
```
Item Card:
┌─────────────────────────────┐
│ Item Image                  │
├─────────────────────────────┤
│ Item Name                   │
│ Category: Groceries         │
│ Description: ...            │
│                             │
│ Specs:                      │
│ ┌─────────┐┌──────┐┌────┐ │
│ │100g     ││Premium││Organic│ │
│ └─────────┘└──────┘└────┘ │
│                             │
│ Price: $100 | Stock: 50    │
│ [🛒 Add to Cart]            │
└─────────────────────────────┘
```

---

## 4. Global Search Request/Response

### Request
```javascript
GET /items/search/global?query=organic+nuts&category=Groceries

Parameters:
- query: "organic nuts" (searches name, description, specs)
- category: "Groceries" (optional filter)
```

### Response
```json
{
  "message": "Global search completed",
  "items": [
    {
      "_id": "item123",
      "itemName": "Organic Nuts Mix",
      "description": "Premium mixed nuts",
      "price": 500,
      "stock": 50,
      "category": "Groceries",
      "specifications": ["100g", "Organic", "Verified"],
      "image": "url...",
      "storeId": {
        "_id": "store456",
        "storeName": "Fresh Mart Store",
        "email": "store@example.com",
        "phone": "9876543210",
        "address": "123 Main St",
        "city": "New York"
      }
    },
    {...more items...}
  ]
}
```

---

## 5. Store Dashboard - Add Item with Specs

### Form Layout
```
┌─────────────────────────────────────────┐
│  Add New Item (or Edit Item)            │
├─────────────────────────────────────────┤
│                                         │
│ Item Name *         [Text Input]        │
│ Description         [Text Area]         │
│ Price *             [Number Input]      │
│ Stock *             [Number Input]      │
│ Category            [Dropdown]          │
│ SKU (Optional)      [Text Input]        │
│ Image URL (Opt.)    [Text Input]        │
│ Specifications      [Text Input]        │  ← NEW!
│ (comma-separated)   (e.g., 100g, Org..)│
│                                         │
│ [Add Item] or [Update Item]             │
│                                         │
└─────────────────────────────────────────┘
```

### Excel Import Template
```
Item Name | Price | Stock | Category   | Specifications
----------|-------|-------|------------|------------------
Nuts      | 500   | 50    | Groceries  | 100g, Organic, Premium
Almonds   | 600   | 30    | Groceries  | 200g, Raw, Certified
Wheat     | 300   | 100   | Groceries  | 1kg, Organic
Bread     | 50    | 200   | Groceries  | (blank - specs optional)
```

---

## 6. Search Matching Logic

### What Gets Searched?

**Store Search:**
```
Fields searched:
- itemName (exact match, case-insensitive)
- category (exact match)
- description (partial match)
- specifications (array contains text)
```

**Global Search:**
```
Fields searched:
- itemName (exact match, case-insensitive)
- category (exact match)
- description (partial match)
- specifications (array contains text)

Plus filter by:
- Category (optional)
- Populated from all stores
```

### Example Searches
```
Query: "organic"
Matches:
✅ itemName: "Organic Nuts"
✅ specifications: ["Organic", "100g"]
✅ description: "Made from organic sources"
✅ category: "Organic Foods"

Query: "100g"
Matches:
✅ specifications: ["100g", "Premium"]
✅ description: "Available in 100g packets"

Query: "nuts"
Matches:
✅ itemName: "Mixed Nuts"
✅ description: "Various types of nuts"
```

---

## 7. Mobile Responsive Layout

### Mobile View - Store Search
```
┌────────────────────────┐
│ 🏪 Search │ 🔍 Global │
├────────────────────────┤
│ [Search in store...]   │
├────────────────────────┤
│ Store:  [Dropdown  ▼] │
├────────────────────────┤
│ Category: [Dropdown ▼] │
├────────────────────────┤
│ ┌──────────────────┐   │
│ │  Item 1          │   │
│ │  + Specs         │   │
│ │  [🛒 Add]        │   │
│ └──────────────────┘   │
│ ┌──────────────────┐   │
│ │  Item 2          │   │
│ │  + Specs         │   │
│ │  [🛒 Add]        │   │
│ └──────────────────┘   │
└────────────────────────┘
```

### Mobile View - Global Search
```
┌────────────────────────┐
│ 🏪 Search │ 🔍 Global │
├────────────────────────┤
│ [Search all items...]  │
├────────────────────────┤
│ Category: [Dropdown ▼] │
├────────────────────────┤
│ ┌──────────────────┐   │
│ │  Item 1          │   │
│ │  Store: ABC      │   │
│ │  + Specs         │   │
│ │  [🛒 Add]        │   │
│ └──────────────────┘   │
│ ┌──────────────────┐   │
│ │  Item 2          │   │
│ │  Store: XYZ      │   │
│ │  + Specs         │   │
│ │  [🛒 Add]        │   │
│ └──────────────────┘   │
└────────────────────────┘
```

---

## 8. Database Schema Updates

### Item Model
```javascript
{
  _id: ObjectId,
  storeId: ObjectId (ref: Store),
  itemName: String (required),
  description: String,
  price: Number (required),
  stock: Number (required),
  category: String (default: "General"),
  sku: String (required, unique),
  image: String,
  specifications: [String],  // NEW!
  createdAt: Date,
  updatedAt: Date
}
```

### Example Document
```json
{
  "_id": "ObjectId(123...)",
  "storeId": "ObjectId(456...)",
  "itemName": "Organic Almond Butter",
  "description": "Pure organic almonds ground into smooth butter",
  "price": 450,
  "stock": 75,
  "category": "Groceries",
  "sku": "ALM-001",
  "image": "https://example.com/almond-butter.jpg",
  "specifications": [
    "200g",
    "Organic Certified",
    "No Added Sugar",
    "Gluten-free"
  ],
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

---

## 9. User Workflow Examples

### Scenario 1: Store Owner Adding Nuts
```
1. Open Store Dashboard
2. Click "Add New Item" button
3. Fill in:
   - Item Name: "Organic Mixed Nuts"
   - Price: 500
   - Stock: 100
   - Category: "Groceries"
   - Image: (URL)
   - Specs: "100g, Organic, Premium, Roasted"
4. Click "Add Item"
5. Item appears in inventory with specs
```

### Scenario 2: Customer Searching Globally
```
1. Open User Dashboard
2. Click "🔍 Global Search" toggle
3. Type "organic nuts" in search
4. See results from ALL stores
   ✓ Fresh Mart - Organic Mixed Nuts (Store: Fresh Mart)
   ✓ Nature Hub - Organic Almonds (Store: Nature Hub)
5. Select category "Groceries" to narrow results
6. Click "🛒 Add" on desired item
7. Item added to cart with store info
```

### Scenario 3: Customer Browsing Store
```
1. Open User Dashboard (defaults to Store Search)
2. Select "Fresh Mart" from store dropdown
3. Select "Groceries" category
4. See all groceries from Fresh Mart
5. Type "nuts" to filter further
6. See specs for each item (100g, Organic, etc.)
7. Add items to cart
```

---

## 10. Testing Scenarios

### Test Case 1: Add Item with Specs
```
✓ Store owner adds: "100g, Organic, Premium"
✓ Parsed to: ["100g", "Organic", "Premium"]
✓ Displayed as 3 blue badges
✓ Searchable by any spec value
```

### Test Case 2: Global Search with Specs
```
✓ Search "Organic" → finds items with "Organic" spec
✓ Search "100g" → finds items with "100g" spec
✓ Filter by "Groceries" → shows only grocery category
✓ Shows store name for each result
```

### Test Case 3: Import with Excel Specs
```
✓ Excel column: "Specifications"
✓ Data: "100g, Organic, Premium"
✓ Imported as: ["100g", "Organic", "Premium"]
✓ Appears in item display
```

### Test Case 4: Mobile Responsiveness
```
✓ Search toggle buttons stack/flow on mobile
✓ Category dropdown displays on mobile
✓ Store dropdown hidden in global search
✓ Specs badges wrap on small screens
✓ All buttons have minimum 44px tap target
```

---

**Ready for Implementation and Testing! ✅**
