# Stationery Store Backend API

A fully functional REST API built with Node.js, Express, Prisma, and PostgreSQL for managing a stationery store's user authentication and profile management.

## 🚀 Features

- ✅ User registration (signup) with password hashing
- ✅ User login with JWT authentication
- ✅ Protected profile routes
- ✅ Profile update functionality
- ✅ Admin-only routes for user management
- ✅ Role-based access control (CUSTOMER/ADMIN)
- ✅ Proper error handling and validation
- ✅ Request logging

## 📋 Prerequisites

- Node.js (v14 or higher)
- PostgreSQL database
- npm or yarn

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   cd stationery-store-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Update the `.env` file with your database credentials:
   ```
   DATABASE_URL="postgresql://username:password@localhost:5432/stationery_store?schema=public"
   JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
   PORT=5000
   NODE_ENV=development
   ```

4. **Set up the database**
   ```bash
   # Generate Prisma client
   npm run prisma:generate

   # Run database migrations
   npm run prisma:migrate
   ```

5. **Start the server**
   ```bash
   # Development mode with auto-reload
   npm run dev

   # Production mode
   npm start
   ```

## 📁 Project Structure

```
backend/
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── client.js              # Prisma client singleton
├── src/
│   ├── app.js                 # Main application file
│   └── modules/
│       └── user/
│           ├── user.controller.js   # Business logic
│           ├── user.routes.js       # Route definitions
│           └── user.middleware.js   # Auth middleware
├── package.json
├── .env
├── .gitignore
└── README.md
```

## 🔌 API Endpoints

### Public Routes

#### 1. User Signup
```http
POST /api/user/signup
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "1234567890",
  "password": "password123",
  "role": "CUSTOMER",          # optional - pass "ADMIN" to create an admin
  "addressLine1": "123 Main St",
  "addressLine2": "Apt 4",
  "city": "Metropolis",
  "state": "CA",
  "postalCode": "90210",
  "country": "USA",
  "photoUrl": "https://example.com/photo.jpg"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "User registered successfully.",
  "data": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "1234567890",
    "role": "CUSTOMER",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### 2. User Login
```http
POST /api/user/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Login successful.",
  "data": {
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "1234567890",
      "role": "CUSTOMER",
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Protected Routes (Require Authentication)

#### 3. Get User Profile
```http
GET /api/user/profile
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Profile retrieved successfully.",
  "data": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "1234567890",
    "role": "CUSTOMER",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### 4. Update User Profile
```http
PUT /api/user/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "John Updated",
  "phone": "9876543210",
  "password": "newpassword123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Profile updated successfully.",
  "data": {
    "id": 1,
    "name": "John Updated",
    "email": "john@example.com",
    "phone": "9876543210",
    "role": "CUSTOMER",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Admin Routes (Require Admin Role)

#### 5. Get All Users
```http
GET /api/user/all
Authorization: Bearer <admin-token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Users retrieved successfully.",
  "data": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "1234567890",
      "role": "CUSTOMER",
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "count": 1
}
```

## 🔐 Authentication

This API uses JWT (JSON Web Tokens) for authentication. After successful login, include the token in the Authorization header:

```
Authorization: Bearer <your-token-here>
```

Tokens are valid for 7 days by default.

## 🗄️ Database Schema

### User Model

| Field        | Type     | Description                          |
|--------------|----------|--------------------------------------|
| id           | Int      | Auto-increment primary key           |
| name         | String   | User's full name                     |
| email        | String   | Unique email address                 |
| phone        | String   | Unique phone number (optional)       |
| passwordHash | String   | Bcrypt hashed password               |
| role         | Enum     | CUSTOMER or ADMIN                    |
| isActive     | Boolean  | Account status (default: true)       |
| createdAt    | DateTime | Account creation timestamp           |
| updatedAt    | DateTime | Last update timestamp                |

## ⚙️ Available Scripts

```bash
# Start server
npm start

# Start server with auto-reload (development)
npm run dev

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Open Prisma Studio (database GUI)
npm run prisma:studio
```

## 🧪 Testing with cURL

### Signup
```bash
curl -X POST http://localhost:5000/api/user/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@example.com","phone":"1234567890","password":"password123"}'
```

### Login
```bash
curl -X POST http://localhost:5000/api/user/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"password123"}'
```

### Get Profile
```bash
curl -X GET http://localhost:5000/api/user/profile \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## 🛡️ Security Features

- Password hashing using bcrypt (10 salt rounds)
- JWT token-based authentication
- Protected routes with middleware
- Role-based access control
- Input validation
- SQL injection prevention (Prisma ORM)
- Active account verification

## 📝 Error Codes

| Status Code | Description                     |
|-------------|---------------------------------|
| 200         | Success                         |
| 201         | Created successfully            |
| 400         | Bad request / Validation error  |
| 401         | Unauthorized / Invalid token    |
| 403         | Forbidden / Insufficient rights |
| 404         | Not found                       |
| 409         | Conflict / Duplicate entry      |
| 500         | Internal server error           |

## 🚧 Future Enhancements

- Email verification
- Password reset functionality
- Refresh token implementation
- Rate limiting
- API documentation with Swagger
- Unit and integration tests
- Logging with Winston or Morgan
- File upload for profile pictures

## 📄 License

ISC

## 👥 Support

For issues or questions, please open an issue in the repository.
