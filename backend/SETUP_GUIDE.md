# 🚀 QUICK SETUP GUIDE - Stationery Store Backend

## Step 1: Install Dependencies
```bash
cd stationery-store-backend
npm install
```

## Step 2: Configure Database
Edit the `.env` file and update your PostgreSQL connection:
```
DATABASE_URL="postgresql://YOUR_USERNAME:YOUR_PASSWORD@localhost:5432/stationery_store?schema=public"
```

## Step 3: Initialize Database
```bash
npm run prisma:generate
npm run prisma:migrate
```

This will:
- Generate the Prisma client
- Create the database tables

## Step 4: Start the Server
```bash
npm run dev
```

Server will start on http://localhost:5000

## 🧪 Test the API

### 1. Health Check
```bash
curl http://localhost:5000/health
```

### 2. Create Admin User
```bash
curl -X POST http://localhost:5000/api/user/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Admin User",
    "email": "admin@stationery.com",
    "password": "admin123",
    "role": "ADMIN"
  }'
```

### 3. Create Customer User
```bash
curl -X POST http://localhost:5000/api/user/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Customer",
    "email": "customer@example.com",
    "phone": "1234567890",
    "password": "customer123"
  }'
```

### 4. Login
```bash
curl -X POST http://localhost:5000/api/user/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer@example.com",
    "password": "customer123"
  }'
```

Save the token from the response!

### 5. Get Profile (Protected Route)
```bash
curl -X GET http://localhost:5000/api/user/profile \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 6. Update Profile
```bash
curl -X PUT http://localhost:5000/api/user/profile \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Updated",
    "phone": "9876543210"
  }'
```

### 7. Get All Users (Admin Only)
```bash
curl -X GET http://localhost:5000/api/user/all \
  -H "Authorization: Bearer ADMIN_TOKEN_HERE"
```

## 📦 Project Structure
```
stationery-store-backend/
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── client.js           # Prisma client
├── src/
│   ├── app.js              # Main Express app
│   └── modules/
│       └── user/
│           ├── user.controller.js   # Business logic
│           ├── user.routes.js       # Routes
│           └── user.middleware.js   # Auth middleware
├── package.json
├── .env                    # Environment variables
└── README.md              # Full documentation
```

## ✅ Verification Checklist

- [ ] Node.js installed (v14+)
- [ ] PostgreSQL installed and running
- [ ] Dependencies installed (`npm install`)
- [ ] .env configured with correct database URL
- [ ] Prisma generated (`npm run prisma:generate`)
- [ ] Database migrated (`npm run prisma:migrate`)
- [ ] Server running (`npm run dev`)
- [ ] Health check passes (`curl http://localhost:5000/health`)
- [ ] Can create users
- [ ] Can login and get token
- [ ] Can access protected routes with token

## 🔧 Troubleshooting

### Error: "req.body is undefined"
✅ Fixed! The app.js includes `app.use(express.json())` BEFORE routes.

### Error: "Cannot find module '@prisma/client'"
Run: `npm run prisma:generate`

### Error: "Database connection failed"
Check your DATABASE_URL in .env file and ensure PostgreSQL is running.

### Error: "Invalid token"
Make sure you're including the token in the Authorization header as:
```
Authorization: Bearer <token>
```

## 🎯 Next Steps

Now you can extend this backend by adding:
- Product management module
- Order management module
- Category management module
- Inventory tracking
- Payment integration
- And more!

### After changing Prisma schema
If you updated `prisma/schema.prisma` (for example adding inventory models or extending user profile fields) run:

```bash
cd backend
npm run prisma:generate
# Run a migration - change the name to something descriptive like "add_user_profile_fields"
npx prisma migrate dev --name add_user_profile_fields
npm run prisma:generate
```

This will apply the new database schema and generate the Prisma client. If you only change generated client types, you may only need `npm run prisma:generate`.

*Note:* We recently added optional user profile fields (`addressLine1`, `addressLine2`, `city`, `state`, `postalCode`, `country`, `photoUrl`). Run the migration above after pulling the latest changes to create these columns in your database.

*If you add Orders/OrderItems to the schema (new in this update), run a migration such as: `npx prisma migrate dev --name add_orders_models` and then `npm run prisma:generate` to apply the changes.*

### New API endpoints (inventory)
- `POST /api/products/:id/restock` (Admin) — Add stock and optional price/images updates.
- `GET /api/products/:id/logs` (Admin) — List inventory logs for a product.
- `GET /api/products/admin/low-stock` (Admin) — Get products where stock ≤ threshold

## 📞 Need Help?

Check the README.md file for comprehensive documentation!
