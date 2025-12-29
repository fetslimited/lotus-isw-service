#!/bin/bash

# Redis Connection Verification Script
# Run this after starting the application to verify Redis is connected
#
# Usage:
#   ./verify-redis.sh
#   REDIS_PASSWORD='your-password' ./verify-redis.sh

echo "========================================="
echo "Redis Connection Verification"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Check if app is running
print_info "Checking if application is running..."
response=$(curl -s http://localhost:3000/health 2>/dev/null)
if [ -z "$response" ]; then
    print_error "Application is not responding on http://localhost:3000"
    echo "Please start the application first: npm run start"
    exit 1
fi
print_success "Application is running"
echo ""

# Check Redis connection from health endpoint
print_info "Checking Redis connection status from /health endpoint..."
redis_connected=$(echo $response | jq -r '.redis.connected' 2>/dev/null)
redis_host=$(echo $response | jq -r '.redis.host' 2>/dev/null)
redis_port=$(echo $response | jq -r '.redis.port' 2>/dev/null)

if [ "$redis_connected" = "true" ]; then
    print_success "Redis is connected"
    echo "  Host: $redis_host"
    echo "  Port: $redis_port"
else
    print_error "Redis is NOT connected"
    echo "  Host: $redis_host"
    echo "  Port: $redis_port"
fi
echo ""

# Check Interswitch status endpoint
print_info "Checking Interswitch socket status..."
isw_response=$(curl -s http://localhost:3000/api/interswitch/status 2>/dev/null)
isw_redis=$(echo $isw_response | jq -r '.redis.connected' 2>/dev/null)
socket_closed=$(echo $isw_response | jq -r '.socketClosed' 2>/dev/null)

if [ "$isw_redis" = "true" ]; then
    print_success "Interswitch reports Redis connected"
else
    print_error "Interswitch reports Redis NOT connected"
fi

if [ "$socket_closed" = "false" ]; then
    print_success "Interswitch socket is open"
else
    print_error "Interswitch socket is closed"
fi
echo ""

# Test direct Redis connection (if redis-cli is available)
if command -v redis-cli &> /dev/null; then
    print_info "Testing direct Redis connection..."
    
    # Get Redis password from environment or prompt
    REDIS_PASSWORD="${REDIS_PASSWORD:-}"
    
    # Build redis-cli command with authentication if password exists
    if [ -n "$REDIS_PASSWORD" ]; then
        redis_cmd="redis-cli -h ${redis_host} -p ${redis_port} -a ${REDIS_PASSWORD}"
        redis_ping=$($redis_cmd ping 2>&1)
    else
        redis_cmd="redis-cli -h ${redis_host} -p ${redis_port}"
        redis_ping=$($redis_cmd ping 2>&1)
    fi
    
    if [ "$redis_ping" = "PONG" ]; then
        print_success "Direct Redis connection successful"
        
        # Check for key exchange data
        print_info "Checking for key exchange data..."
        key_exists=$($redis_cmd EXISTS isw:key_exchange:1001 2>&1)
        
        if [ "$key_exists" = "1" ]; then
            print_success "Key exchange data exists in Redis"
            echo ""
            print_info "Key exchange data:"
            $redis_cmd --raw GET isw:key_exchange:1001 | jq '.' 2>/dev/null || \
            $redis_cmd GET isw:key_exchange:1001
        else
            print_info "Key exchange data not yet available (trigger key exchange to populate)"
        fi
    else
        # Check if error is auth-related
        if echo "$redis_ping" | grep -q "NOAUTH\|AUTH"; then
            print_error "Redis authentication required. Set REDIS_PASSWORD environment variable"
            echo "  Example: REDIS_PASSWORD='your-password' ./verify-redis.sh"
        else
            print_error "Direct Redis connection failed: $redis_ping"
        fi
    fi
else
    print_info "redis-cli not found, skipping direct connection test"
fi

echo ""
echo "========================================="
echo "Verification Complete"
echo "========================================="

# Summary
echo ""
if [ "$redis_connected" = "true" ] && [ "$isw_redis" = "true" ]; then
    print_success "All checks passed! Redis is properly connected."
    exit 0
else
    print_error "Some checks failed. Please review the output above."
    exit 1
fi
