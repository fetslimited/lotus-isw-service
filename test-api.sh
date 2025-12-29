#!/bin/bash

# ISW Service API Test Script
# Test the Interswitch key exchange endpoints

BASE_URL="http://localhost:3000/api/interswitch"

echo "========================================="
echo "ISW Service API Test Script"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Test 1: Check Socket Status
echo "Test 1: Checking socket status..."
echo "GET $BASE_URL/status"
echo ""
response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/status")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

echo "$body" | jq '.' 2>/dev/null || echo "$body"
echo ""

if [ "$http_code" -eq 200 ]; then
    print_success "Status check successful (HTTP $http_code)"
else
    print_error "Status check failed (HTTP $http_code)"
fi
echo ""
echo "========================================="
echo ""

# Test 2: Trigger Key Exchange
echo "Test 2: Triggering key exchange..."
echo "POST $BASE_URL/key-exchange"
echo ""
response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/key-exchange" \
    -H "Content-Type: application/json")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

echo "$body" | jq '.' 2>/dev/null || echo "$body"
echo ""

if [ "$http_code" -eq 200 ]; then
    print_success "Key exchange triggered successfully (HTTP $http_code)"
else
    print_error "Key exchange failed (HTTP $http_code)"
fi
echo ""
echo "========================================="
echo ""

# Test 3: Trigger Echo
echo "Test 3: Triggering echo request..."
echo "POST $BASE_URL/echo"
echo ""
response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/echo" \
    -H "Content-Type: application/json")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

echo "$body" | jq '.' 2>/dev/null || echo "$body"
echo ""

if [ "$http_code" -eq 200 ]; then
    print_success "Echo triggered successfully (HTTP $http_code)"
else
    print_error "Echo failed (HTTP $http_code)"
fi
echo ""
echo "========================================="
echo ""

# Test 4: Check Status Again
echo "Test 4: Checking socket status again..."
echo "GET $BASE_URL/status"
echo ""
response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/status")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

echo "$body" | jq '.' 2>/dev/null || echo "$body"
echo ""

if [ "$http_code" -eq 200 ]; then
    print_success "Status check successful (HTTP $http_code)"
else
    print_error "Status check failed (HTTP $http_code)"
fi
echo ""
echo "========================================="
echo ""

print_info "Test complete!"
echo ""
