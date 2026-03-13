#!/bin/bash

echo "=== WISHLIST MOVE TO CART TEST ==="
echo ""

# Login with YOUR credentials
echo "1. Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/user/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "priyanshu@stationery.com",
    "password": "pkg123"
  }')

echo "$LOGIN_RESPONSE" | jq .

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.token')
echo ""
echo "Token extracted: ${TOKEN:0:30}..."
echo ""

# Check if token is valid
if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login failed! Check your credentials."
  exit 1
fi

# Clear wishlist
echo "2. Clearing wishlist..."
curl -s -X DELETE http://localhost:3000/api/wishlist/clear/all \
  -H "Authorization: Bearer $TOKEN" | jq .
echo ""

# Add product to wishlist
echo "3. Adding product 4 to wishlist..."
curl -s -X POST http://localhost:3000/api/wishlist \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": 4,
    "note": "Test item"
  }' | jq .
echo ""

# Check wishlist
echo "4. Checking wishlist (should have 1 item)..."
curl -s http://localhost:3000/api/wishlist \
  -H "Authorization: Bearer $TOKEN" | jq '.count'
echo ""

# Move to cart
echo "5. Moving to cart..."
MOVE_RESPONSE=$(curl -s -X POST http://localhost:3000/api/wishlist/4/move-to-cart \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 1
  }')

echo "$MOVE_RESPONSE" | jq .
echo ""

# Check if successful
SUCCESS=$(echo "$MOVE_RESPONSE" | jq -r '.success')

if [ "$SUCCESS" = "true" ]; then
  echo "✅ SUCCESS! Item moved to cart!"
else
  echo "❌ FAILED! Error: $(echo "$MOVE_RESPONSE" | jq -r '.message')"
fi
echo ""

# Check cart
echo "6. Checking cart (should have the item)..."
curl -s http://localhost:3000/api/cart \
  -H "Authorization: Bearer $TOKEN" | jq '.data.itemCount'
echo ""

# Check wishlist
echo "7. Checking wishlist (should be empty)..."
curl -s http://localhost:3000/api/wishlist \
  -H "Authorization: Bearer $TOKEN" | jq '.count'


echo "Add items to Cart"
# 1. Add items to cart
curl -X POST http://localhost:3000/api/cart \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": 4,
    "quantity": 2
  }'

# 2. Verify cart has items
echo "Verify Cart Item"
curl http://localhost:3000/api/cart \
  -H "Authorization: Bearer $TOKEN" | jq '.data.itemCount'

# 3. Now create order
echo "Now Create order"
curl -X POST http://localhost:3000/api/orders \
  -H "Authorization: Bearer $TOKEN"
