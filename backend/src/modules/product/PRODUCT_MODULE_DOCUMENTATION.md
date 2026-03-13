# 📦 Product Module - Complete Documentation

## Overview
Business-aware product management system for a stationery store with support for BOOKS and TOYS categories.

---

## 🎯 Business Logic

### Category System
- **STATIONERY** - Pens, notebooks, staplers, etc.
- **BOOKS** - Educational, reference, novels
- **TOYS** - Children's items

### Pricing Strategy
- `costPrice` - Internal procurement cost (not visible to customers)
- `baseSellingPrice` - Default customer-facing price
- **Profit Margin** = `(baseSellingPrice - costPrice) / baseSellingPrice × 100`
- **Business Rule**: `baseSellingPrice` must be >= `costPrice`

### Bargaining System
- `bargainable: true` - Discounts/negotiations allowed
- `bargainable: false` - Fixed price, no negotiation

### Inventory Safety
- `lowStockThreshold` - Minimum safe stock level
- Used for alerts and purchase planning
- Future: Compare against actual stock for warnings

### Soft Deletion
- `isActive: true` - Visible and sellable
- `isActive: false` - Hidden but retained in database

---

## 🗄️ Database Schema

```prisma
model Product {
  id                Int      @id @default(autoincrement())
  name              String
  description       String?
  category          Category
  subCategory       String
  costPrice         Float
  baseSellingPrice  Float
  bargainable       Boolean  @default(true)
  lowStockThreshold Int
  isActive          Boolean  @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

enum Category {
  STATIONERY
  BOOKS
  TOYS
}
```

---

## 🔌 API Endpoints

### **Public Endpoints**

#### 1. Get All Products
```http
GET /api/products
```

**Query Parameters:**
- `isActive` - Filter by status (true/false)
- `category` - Filter by category (STATIONERY/BOOKS/TOYS)
- `minPrice` - Minimum base selling price
- `maxPrice` - Maximum base selling price
- `search` - Search in name, description, subCategory
- `bargainable` - Filter by bargaining status (true/false)

**Example:**
```bash
curl "http://localhost:3000/api/products?category=STATIONERY&bargainable=true&minPrice=5&maxPrice=50"
```

**Response:**
```json
{
  "success": true,
  "message": "Products retrieved successfully.",
  "data": [
    {
      "id": 1,
      "name": "Blue Ballpoint Pen",
      "description": "Smooth writing pen",
      "category": "STATIONERY",
      "subCategory": "Pens",
      "costPrice": 2.50,
      "baseSellingPrice": 5.99,
      "bargainable": true,
      "lowStockThreshold": 20,
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "count": 1
}
```

---

#### 2. Get Product by ID
```http
GET /api/products/:id
```

**Example:**
```bash
curl http://localhost:3000/api/products/1
```

---

#### 3. Get Products by Category
```http
GET /api/products/category/:category
```

**Valid Categories:** STATIONERY, BOOKS, TOYS

**Example:**
```bash
curl http://localhost:3000/api/products/category/STATIONERY
```

**Response:**
```json
{
  "success": true,
  "message": "Products in STATIONERY category retrieved successfully.",
  "data": [...],
  "count": 15
}
```

---

### **Admin Endpoints**

#### 4. Create Product
```http
POST /api/products
Authorization: Bearer <admin-token>
Content-Type: application/json
```

**Required Fields:**
- `name` - Product name
- `category` - STATIONERY | BOOKS | TOYS
- `subCategory` - Specific subcategory
- `costPrice` - Cost (>= 0)
- `baseSellingPrice` - Selling price (>= costPrice)
- `lowStockThreshold` - Integer (>= 0)

**Optional Fields:**
- `description` - Product description
- `bargainable` - Boolean (default: true)

**Example:**
```bash
curl -X POST http://localhost:3000/api/products \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "A4 Notebook",
    "description": "200 pages ruled notebook",
    "category": "STATIONERY",
    "subCategory": "Notebooks",
    "costPrice": 8.00,
    "baseSellingPrice": 15.99,
    "bargainable": false,
    "lowStockThreshold": 10
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Product created successfully.",
  "data": {
    "id": 1,
    "name": "A4 Notebook",
    "description": "200 pages ruled notebook",
    "category": "STATIONERY",
    "subCategory": "Notebooks",
    "costPrice": 8.00,
    "baseSellingPrice": 15.99,
    "bargainable": false,
    "lowStockThreshold": 10,
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "profitMargin": "49.97%"
  }
}
```

---

#### 5. Update Product
```http
PUT /api/products/:id
Authorization: Bearer <admin-token>
```

**All fields optional**

**Example:**
```bash
curl -X PUT http://localhost:3000/api/products/1 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "baseSellingPrice": 17.99,
    "lowStockThreshold": 15
  }'
```

---

#### 6. Delete Product
```http
DELETE /api/products/:id
Authorization: Bearer <admin-token>
```

**Example:**
```bash
curl -X DELETE http://localhost:3000/api/products/1 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

#### 7. Toggle Product Status (Soft Delete)
```http
PATCH /api/products/:id/toggle-status
Authorization: Bearer <admin-token>
```

**Example:**
```bash
curl -X PATCH http://localhost:3000/api/products/1/toggle-status \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "message": "Product deactivated successfully.",
  "data": {
    "id": 1,
    "isActive": false,
    ...
  }
}
```

---

#### 8. Get Low Stock Products
```http
GET /api/products/admin/low-stock
Authorization: Bearer <admin-token>
```

**Note:** Currently returns products ordered by threshold. Implement actual stock tracking for real alerts.

---

## 🔐 Access Control

| Endpoint | Access | Authentication |
|----------|--------|----------------|
| GET /api/products | Public | None |
| GET /api/products/:id | Public | None |
| GET /api/products/category/:category | Public | None |
| POST /api/products | Admin | JWT + Admin Role |
| PUT /api/products/:id | Admin | JWT + Admin Role |
| DELETE /api/products/:id | Admin | JWT + Admin Role |
| PATCH /api/products/:id/toggle-status | Admin | JWT + Admin Role |
| GET /api/products/admin/low-stock | Admin | JWT + Admin Role |

---

## ✅ Validation Rules

### Name
- Required: Yes
- Type: String

### Category
- Required: Yes
- Type: Enum
- Values: STATIONERY, BOOKS, TOYS

### SubCategory
- Required: Yes
- Type: String

### Cost Price
- Required: Yes
- Type: Float
- Min: 0

### Base Selling Price
- Required: Yes
- Type: Float
- Min: 0
- **Business Rule:** Must be >= costPrice

### Bargainable
- Required: No
- Type: Boolean
- Default: true

### Low Stock Threshold
- Required: Yes
- Type: Integer
- Min: 0

---

## 🧪 Testing Guide

### Setup
```bash
# 1. Update schema
# Copy schema.prisma content

# 2. Run migration
npx prisma generate
npx prisma migrate dev --name add_product_model

# 3. Create admin user
curl -X POST http://localhost:3000/api/user/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Admin",
    "email": "admin@store.com",
    "password": "admin123",
    "role": "ADMIN"
  }'

# 4. Login
curl -X POST http://localhost:3000/api/user/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@store.com",
    "password": "admin123"
  }'

# Save the token!
TOKEN="YOUR_TOKEN_HERE"
```

### Create Sample Products

**Stationery:**
```bash
curl -X POST http://localhost:3000/api/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Parker Jotter Pen",
    "description": "Premium ballpoint pen",
    "category": "STATIONERY",
    "subCategory": "Pens",
    "costPrice": 15.00,
    "baseSellingPrice": 29.99,
    "bargainable": false,
    "lowStockThreshold": 5
  }'
```

**Books:**
```bash
curl -X POST http://localhost:3000/api/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mathematics Grade 10",
    "description": "NCERT textbook",
    "category": "BOOKS",
    "subCategory": "Textbooks",
    "costPrice": 120.00,
    "baseSellingPrice": 150.00,
    "bargainable": true,
    "lowStockThreshold": 10
  }'
```

**Toys:**
```bash
curl -X POST http://localhost:3000/api/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Building Blocks Set",
    "description": "100 pieces educational blocks",
    "category": "TOYS",
    "subCategory": "Educational",
    "costPrice": 250.00,
    "baseSellingPrice": 499.00,
    "bargainable": true,
    "lowStockThreshold": 3
  }'
```

### Query Products

```bash
# All products
curl http://localhost:3000/api/products

# Only STATIONERY
curl http://localhost:3000/api/products/category/STATIONERY

# Bargainable items
curl "http://localhost:3000/api/products?bargainable=true"

# Price range
curl "http://localhost:3000/api/products?minPrice=100&maxPrice=200"

# Search
curl "http://localhost:3000/api/products?search=pen"
```

---

## ⚠️ Error Responses

### Invalid Category
```json
{
  "success": false,
  "message": "Invalid category. Must be one of: STATIONERY, BOOKS, TOYS"
}
```

### Price Validation Error
```json
{
  "success": false,
  "message": "baseSellingPrice cannot be less than costPrice."
}
```

### Missing Required Fields
```json
{
  "success": false,
  "message": "name, category, subCategory, costPrice, baseSellingPrice, and lowStockThreshold are required."
}
```

---

## 📊 Business Insights

### Profit Margin Calculation
Automatically calculated on create/update:
```
Profit Margin = ((baseSellingPrice - costPrice) / baseSellingPrice) × 100
```

Example:
- Cost: ₹8.00
- Selling: ₹15.99
- Margin: 49.97%

---

## 🚀 Migration Steps

```bash
# 1. Update your backend/prisma/schema.prisma
# Add the Product model and Category enum

# 2. Generate Prisma client
npx prisma generate

# 3. Create migration
npx prisma migrate dev --name add_product_model

# 4. Copy module files
# - product.controller.js → src/modules/product/
# - product.routes.js → src/modules/product/

# 5. Update app.js
# Add: const productRoutes = require('./modules/product/product.routes');
# Add: app.use('/api/products', productRoutes);

# 6. Restart server
npm run dev
```

---

## ✅ Features Checklist

- [x] Category-based classification (STATIONERY, BOOKS, TOYS)
- [x] Cost vs Selling price tracking
- [x] Profit margin calculation
- [x] Bargaining flag
- [x] Low stock threshold
- [x] Soft deletion (isActive)
- [x] Search & filter
- [x] Role-based access control
- [x] Input validation
- [x] Business rule enforcement (selling >= cost)

---

*Product Module v1.0 - Ready for Production* 🎉
