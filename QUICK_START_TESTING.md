# Quick Start Testing Guide

## 🚀 Getting Started

### Backend API Changes
All endpoints are ready to use:
- ✅ Global search: `GET /items/search/global?query=text&category=name`
- ✅ Categories: `GET /items/categories/all`
- ✅ Item specs support in add/update/import

### Frontend Changes
- ✅ UserDashboard: Global + Store search with specs
- ✅ StoreDashboard: Add/edit items with specs
- ✅ Mobile responsive throughout

---

## 🧪 Testing Checklist

### 1. Store Owner - Add Item with Specs ✓
```
Steps:
1. Login to Store Dashboard
2. Click "+ Add" button
3. Fill fields:
   - Item Name: "Organic Almonds"
   - Price: 600
   - Stock: 50
   - Category: "Groceries"
   - Specs: "200g, Organic, Roasted, Salted"
4. Click "Add Item"

Expected:
✅ Item added successfully
✅ Specs parsed and stored
✅ Item appears in list
```

### 2. Store Owner - Import Items with Specs ✓
```
Excel Template:
Item Name      | Price | Stock | Category   | Specifications
Almonds        | 600   | 50    | Groceries  | 200g, Organic, Roasted
Walnuts        | 700   | 30    | Groceries  | 250g, Raw, Premium
Peanuts        | 400   | 100   | Groceries  | 150g, Salted

Steps:
1. Create Excel file with columns above
2. In Store Dashboard, click "📥 Import Excel"
3. Upload file
4. Items imported with specs

Expected:
✅ All items imported
✅ Specs split correctly
✅ Items searchable by specs
```

### 3. User - Store Search ✓
```
Steps:
1. Login to User Dashboard
2. Click "🏪 Store Search" (default)
3. Select store from dropdown
4. Select category "Groceries"
5. Type in search: "organic"

Expected:
✅ Shows items from selected store
✅ Filtered by "Groceries" category
✅ Contains "organic" in name/desc/specs
✅ Specs shown as blue badges
```

### 4. User - Global Search ✓
```
Steps:
1. In User Dashboard
2. Click "🔍 Global Search" toggle
3. Type search: "almonds"
4. (Optional) Select category "Groceries"

Expected:
✅ Shows almond items from ALL stores
✅ Store name shown for each item
✅ Filtered by category (if selected)
✅ Results searchable across specs
```

### 5. Specifications Display ✓
```
Steps:
1. View any item card
2. Look for "Specs:" section
3. Should show blue badges

Example Display:
Specs:
┌─────────┐ ┌──────────┐ ┌────────┐
│ 200g    │ │ Organic  │ │ Roasted │
└─────────┘ └──────────┘ └────────┘

Expected:
✅ Specs visible as badges
✅ No specs = no badges shown
✅ Wraps on mobile
```

### 6. Category Filter ✓
```
Steps:
1. Open categories dropdown
2. Select "Electronics" (or any)
3. Browse items

Expected:
✅ Dropdown shows all categories
✅ "All" option clears filter
✅ Only matching categories shown
✅ Works in both search modes
```

### 7. Mobile Responsiveness ✓
```
Steps:
1. Open User Dashboard on mobile (375px)
2. Test search toggle buttons
3. Test category dropdown
4. Browse item cards
5. Check specs badge wrapping

Expected:
✅ Toggle buttons readable
✅ Dropdowns accessible
✅ Item cards display properly
✅ Specs wrap nicely
✅ All buttons tappable (44px+)
```

---

## 🎯 Test Data to Create

### Test Stores
```
Store 1: "Fresh Mart"
- Items: Groceries (nuts, grains, oils)

Store 2: "Tech Hub"
- Items: Electronics (gadgets, accessories)

Store 3: "Health First"
- Items: Health (vitamins, supplements, organic)
```

### Test Items with Specs
```
Groceries:
- Organic Almonds: "200g, Organic, Roasted, Premium"
- Wild Honey: "250ml, Raw, Organic, Certified"
- Olive Oil: "500ml, Extra Virgin, Organic, Cold-pressed"

Electronics:
- USB Cable: "1m, Fast Charging, Premium Quality"
- Phone Case: "iPhone 12, Premium, Black, Slim"

Health:
- Vitamin C: "1000mg, Vegan, Gluten-free, Certified"
- Protein Powder: "1kg, Vanilla, Organic, Non-GMO"
```

---

## 🔍 Searching & Filtering Examples

### Global Search Examples
```
Search Query: "organic"
Matches:
✓ "Organic Almonds"
✓ Item with spec "Organic"
✓ Store name containing "Organic"
✓ Category: "Organic Foods"

Results: All organic items across all stores

---

Search Query: "200g"
Matches:
✓ Description containing "200g"
✓ Spec: "200g"

Results: All 200g items from any store

---

Search Query: "almonds" + Category: "Groceries"
Matches:
✓ "Organic Almonds" (has spec "200g, Organic")
✓ Category must be "Groceries"

Results: Only almond items in Groceries category
```

---

## 📊 Data Validation

### Valid Specifications Format
```
✅ "100g, Organic, Premium"
✅ "200ml,Raw,Cold-pressed"
✅ "1kg"
✅ (empty - optional)

❌ "100g,,,Organic" - extra commas (creates empty values)
✅ Will still work but creates ["100g", "", "", "Organic"]
```

### Category Names
```
✅ Valid categories
- Groceries
- Electronics
- Health
- Clothing
- Books
- Home
- Sports
- Any custom category
```

---

## 🐛 Debugging Guide

### If Global Search Returns No Results
```
Check:
1. Are items saved to database?
   → Query Compass/MongoDB
2. Do items have matching specs/name/description?
   → Search is case-insensitive, partial match
3. Is category filter applied?
   → Try removing category filter
4. Are search terms correct?
   → Try searching for exact item name
```

### If Specs Not Showing
```
Check:
1. Are specs saved in database?
   → Check item document in MongoDB
2. Is specs field an array?
   → Should be: specifications: ["spec1", "spec2"]
3. Is item component rendering specs?
   → Check UserDashboard specs rendering code
```

### If Category Filter Not Working
```
Check:
1. Did you fetch categories on mount?
   → Check useEffect for fetchCategories()
2. Is category list populated?
   → Check dropdown options
3. Is selected category matching?
   → Search is case-sensitive for category
```

### If Import Fails
```
Check:
1. Is Excel column name correct?
   → Should be "Specifications", "Specs", or close variant
2. Are specs comma-separated?
   → Format: "spec1, spec2, spec3"
3. Is file format correct?
   → Should be .xlsx, .xls, or .csv
```

---

## ✅ Verification Checklist

- [ ] Backend routes working (test in Postman)
- [ ] Global search returns cross-store results
- [ ] Categories list populates correctly
- [ ] Specs display as blue badges
- [ ] Specs are searchable (both modes)
- [ ] Store search filters by store
- [ ] Global search shows store names
- [ ] Category filter works (both modes)
- [ ] Items import with specs from Excel
- [ ] Items add with specs from form
- [ ] Mobile layout responsive
- [ ] No errors in console
- [ ] No errors in terminal

---

## 📱 Browser Testing

### Desktop (1440px+)
```
✅ Sidebar visible
✅ Items in grid (3 columns)
✅ All filters visible
✅ Specs badges visible
```

### Tablet (768px)
```
✅ Filters in dropdown/sidebar
✅ Items in 2-3 columns
✅ Search toggles readable
✅ Specs wrap nicely
```

### Mobile (375px)
```
✅ Search toggles stack/flow
✅ Items in 1 column
✅ Filters accessible
✅ Specs badges visible
✅ All buttons tappable
```

---

## 🎓 Feature Summary

| Feature | Status | Notes |
|---------|--------|-------|
| Global Search | ✅ | Across all stores |
| Store Search | ✅ | Within selected store |
| Category Filter | ✅ | Works with both searches |
| Specifications | ✅ | Optional, searchable, importable |
| Mobile Responsive | ✅ | Tested on 375px+ |
| Excel Import | ✅ | With specs column support |
| Spec Badges | ✅ | Blue, wrap on mobile |
| Store Names | ✅ | Shown in global search |

---

## 🚨 Common Issues & Solutions

### Issue: Specs not showing in item card
**Solution:** Check that item.specifications exists and is array
```javascript
// In UserDashboard item rendering:
{item.specifications && item.specifications.length > 0 && (
  <div>...</div>
)}
```

### Issue: Global search very slow
**Solution:** Results limited to 100, check query optimization
```javascript
// In globalSearch controller:
.limit(100)  // Limits results
```

### Issue: Category dropdown empty
**Solution:** Ensure categories fetch happens on mount
```javascript
// In useEffect:
const fetchCategories = async () => {
  const { data } = await axios.get("/items/categories/all");
  setCategories(["All", ...data.categories]);
}
```

### Issue: Specs split incorrectly from Excel
**Solution:** Check column name and format
```javascript
// Column name should be one of:
"Specifications", "specifications", "Specs", "specs"

// Format should be:
"100g, Organic, Premium"  ✅
"100g,Organic,Premium"    ✅ (works too)
```

---

## 📞 Support

For issues, check:
1. Browser console for errors
2. Server logs for API errors
3. MongoDB collections for data
4. Network tab for failed requests

All code is documented and ready for testing!

**Status: ✅ Ready for QA and Testing**
