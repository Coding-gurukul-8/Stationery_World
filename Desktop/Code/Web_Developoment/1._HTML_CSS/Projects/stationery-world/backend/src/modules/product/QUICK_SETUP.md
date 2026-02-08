# 🚀 Product Module - Quick Setup

## Files Included

1. **schema.prisma** - Database schema with Product model
2. **product.controller.js** - All business logic
3. **product.routes.js** - API routes
4. **app.js** - Updated with product routes
5. **PRODUCT_MODULE_DOCUMENTATION.md** - Complete API docs

---

## Installation (3 Steps)

### Step 1: Copy Files

```bash
cd /Users/priyanshugupta/Desktop/Code/Web_Developoment/1._HTML_CSS/Projects/stationery-world/backend

# Create product module directory
mkdir -p src/modules/product

# Copy controller and routes
# (Download and copy product.controller.js and product.routes.js to src/modules/product/)
```

### Step 2: Update Your Files

**Update `prisma/schema.prisma`:**
Add the Product model and Category enum from the provided schema.prisma file.

**Update `src/app.js`:**
Add this line after your user routes import:
```javascript
const productRoutes = require('./modules/product/product.routes');
```

Add this route registration:
```javascript
app.use('/api/products', productRoutes);
```

### Step 3: Run Migration

```bash
# Generate Prisma client
npx prisma generate

# Create database migration
npx prisma migrate dev --name add_product_model

# Restart server
npm run dev
```

---

## Quick Test

```bash
# 1. Login as admin (or create admin first)
curl -X POST http://localhost:3000/api/user/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@store.com",
    "password": "admin123"
  }'

# 2. Save the token from response
TOKEN="YOUR_TOKEN_HERE"

# 3. Create a product
curl -X POST http://localhost:3000/api/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Blue Pen",
    "description": "Smooth writing",
    "category": "STATIONERY",
    "subCategory": "Pens",
    "costPrice": 2.50,
    "baseSellingPrice": 5.99,
    "bargainable": true,
    "lowStockThreshold": 20
  }'

# 4. Get all products (public)
curl http://localhost:3000/api/products

# 5. Get by category
curl http://localhost:3000/api/products/category/STATIONERY
```

---

## Available Categories

- **STATIONERY** - Pens, notebooks, staplers, etc.
- **BOOKS** - Textbooks, novels, reference books
- **TOYS** - Educational toys, games

---

## Key Features

✅ **Cost & Selling Price Tracking** - Separate fields with profit margin calculation
✅ **Bargaining System** - Flag products as negotiable or fixed price
✅ **Low Stock Alerts** - Set threshold for inventory warnings
✅ **Soft Deletion** - Deactivate without losing data
✅ **Category-Based** - Organized classification system
✅ **Admin Protection** - Only admins can create/modify products
✅ **Search & Filter** - Find products by name, category, price range

---

## API Endpoints Summary

**Public:**
- `GET /api/products` - All products with filters
- `GET /api/products/:id` - Single product
- `GET /api/products/category/:category` - Products by category

**Admin Only:**
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product
- `PATCH /api/products/:id/toggle-status` - Activate/deactivate
- `GET /api/products/admin/low-stock` - Low stock monitoring

---

## Validation Rules

**Required fields for creation:**
- name
- category (STATIONERY | BOOKS | TOYS)
- subCategory
- costPrice (must be >= 0)
- baseSellingPrice (must be >= costPrice)
- lowStockThreshold (integer >= 0)

**Business rule:**
- Selling price cannot be less than cost price

---

## Next Steps

1. Copy the files to your project
2. Update schema.prisma
3. Update app.js
4. Run migration
5. Test with the provided curl commands

For detailed documentation, see **PRODUCT_MODULE_DOCUMENTATION.md**

---

**Ready to power your stationery store!** 🎉
