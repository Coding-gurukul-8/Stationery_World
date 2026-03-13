#!/bin/bash

# Stationery Store API Test Script
# This script tests all API endpoints

BASE_URL="http://localhost:5000"

echo "=========================================="
echo "Stationery Store API Testing Script"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test 1: Health Check
echo -e "${BLUE}1. Testing Health Check...${NC}"
response=$(curl -s -w "\n%{http_code}" $BASE_URL/health)
http_code=$(echo "$response" | tail -n 1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" -eq 200 ]; then
    echo -e "${GREEN}✓ Health check passed${NC}"
    echo "$body" | jq .
else
    echo -e "${RED}✗ Health check failed (HTTP $http_code)${NC}"
fi
echo ""

# Test 2: User Signup (Customer)
echo -e "${BLUE}2. Testing User Signup (Customer)...${NC}"
response=$(curl -s -w "\n%{http_code}" -X POST $BASE_URL/api/user/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Customer",
    "email": "customer@test.com",
    "phone": "1234567890",
    "password": "test123"
  }')
http_code=$(echo "$response" | tail -n 1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" -eq 201 ]; then
    echo -e "${GREEN}✓ Customer signup successful${NC}"
    echo "$body" | jq .
else
    echo -e "${RED}✗ Customer signup failed (HTTP $http_code)${NC}"
    echo "$body" | jq .
fi
echo ""

# Test 3: User Signup (Admin)
echo -e "${BLUE}3. Testing User Signup (Admin)...${NC}"
response=$(curl -s -w "\n%{http_code}" -X POST $BASE_URL/api/user/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Admin",
    "email": "admin@test.com",
    "phone": "9999999999",
    "password": "admin123",
    "role": "ADMIN"
  }')
http_code=$(echo "$response" | tail -n 1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" -eq 201 ]; then
    echo -e "${GREEN}✓ Admin signup successful${NC}"
    echo "$body" | jq .
else
    echo -e "${RED}✗ Admin signup failed (HTTP $http_code)${NC}"
    echo "$body" | jq .
fi
echo ""

# Test 4: Customer Login
echo -e "${BLUE}4. Testing Customer Login...${NC}"
response=$(curl -s -w "\n%{http_code}" -X POST $BASE_URL/api/user/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer@test.com",
    "password": "test123"
  }')
http_code=$(echo "$response" | tail -n 1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" -eq 200 ]; then
    echo -e "${GREEN}✓ Customer login successful${NC}"
    CUSTOMER_TOKEN=$(echo "$body" | jq -r '.data.token')
    echo "$body" | jq .
else
    echo -e "${RED}✗ Customer login failed (HTTP $http_code)${NC}"
    echo "$body" | jq .
fi
echo ""

# Test 5: Admin Login
echo -e "${BLUE}5. Testing Admin Login...${NC}"
response=$(curl -s -w "\n%{http_code}" -X POST $BASE_URL/api/user/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "admin123"
  }')
http_code=$(echo "$response" | tail -n 1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" -eq 200 ]; then
    echo -e "${GREEN}✓ Admin login successful${NC}"
    ADMIN_TOKEN=$(echo "$body" | jq -r '.data.token')
    echo "$body" | jq .
else
    echo -e "${RED}✗ Admin login failed (HTTP $http_code)${NC}"
    echo "$body" | jq .
fi
echo ""

# Test 6: Get Customer Profile
echo -e "${BLUE}6. Testing Get Customer Profile...${NC}"
response=$(curl -s -w "\n%{http_code}" -X GET $BASE_URL/api/user/profile \
  -H "Authorization: Bearer $CUSTOMER_TOKEN")
http_code=$(echo "$response" | tail -n 1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" -eq 200 ]; then
    echo -e "${GREEN}✓ Get profile successful${NC}"
    echo "$body" | jq .
else
    echo -e "${RED}✗ Get profile failed (HTTP $http_code)${NC}"
    echo "$body" | jq .
fi
echo ""

# Test 7: Update Customer Profile
echo -e "${BLUE}7. Testing Update Customer Profile...${NC}"
response=$(curl -s -w "\n%{http_code}" -X PUT $BASE_URL/api/user/profile \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Customer Updated",
    "phone": "9876543210"
  }')
http_code=$(echo "$response" | tail -n 1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" -eq 200 ]; then
    echo -e "${GREEN}✓ Update profile successful${NC}"
    echo "$body" | jq .
else
    echo -e "${RED}✗ Update profile failed (HTTP $http_code)${NC}"
    echo "$body" | jq .
fi
echo ""

# Test 8: Get All Users (Admin Only)
echo -e "${BLUE}8. Testing Get All Users (Admin Token)...${NC}"
response=$(curl -s -w "\n%{http_code}" -X GET $BASE_URL/api/user/all \
  -H "Authorization: Bearer $ADMIN_TOKEN")
http_code=$(echo "$response" | tail -n 1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" -eq 200 ]; then
    echo -e "${GREEN}✓ Get all users successful${NC}"
    echo "$body" | jq .
else
    echo -e "${RED}✗ Get all users failed (HTTP $http_code)${NC}"
    echo "$body" | jq .
fi
echo ""

# Test 9: Get All Users with Customer Token (Should Fail)
echo -e "${BLUE}9. Testing Get All Users (Customer Token - Should Fail)...${NC}"
response=$(curl -s -w "\n%{http_code}" -X GET $BASE_URL/api/user/all \
  -H "Authorization: Bearer $CUSTOMER_TOKEN")
http_code=$(echo "$response" | tail -n 1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" -eq 403 ]; then
    echo -e "${GREEN}✓ Correctly denied access (403)${NC}"
    echo "$body" | jq .
else
    echo -e "${RED}✗ Should have denied access (HTTP $http_code)${NC}"
    echo "$body" | jq .
fi
echo ""

# Test 10: Access Protected Route Without Token (Should Fail)
echo -e "${BLUE}10. Testing Protected Route Without Token (Should Fail)...${NC}"
response=$(curl -s -w "\n%{http_code}" -X GET $BASE_URL/api/user/profile)
http_code=$(echo "$response" | tail -n 1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" -eq 401 ]; then
    echo -e "${GREEN}✓ Correctly denied access (401)${NC}"
    echo "$body" | jq .
else
    echo -e "${RED}✗ Should have denied access (HTTP $http_code)${NC}"
    echo "$body" | jq .
fi
echo ""

echo "=========================================="
echo "Testing Complete!"
echo "=========================================="
