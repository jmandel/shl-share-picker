#!/bin/bash

# Zero-Trust Web Rails - Multi-Origin Local Testing
# Starts 5 servers on different localhost subdomains/ports

echo "🚀 Starting Zero-Trust Web Rails demo in multi-origin mode..."
echo ""
echo "This will start 5 servers:"
echo "  • Requester:  http://requester.localhost:3000"
echo "  • Gateway:    http://gateway.localhost:3001"
echo "  • Flexpa:     http://flexpa.localhost:3002"
echo "  • b.well:     http://bwell.localhost:3003"
echo "  • Premera:    http://premera.localhost:3004"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Function to start a server
start_server() {
  local dir=$1
  local port=$2
  local name=$3

  echo "Starting $name on port $port..."
  (cd "$dir" && python3 -m http.server $port 2>&1 | sed "s/^/[$name] /") &
}

# Start all servers
start_server "requester" 3000 "Requester"
start_server "gateway" 3001 "Gateway"
start_server "wallet-flexpa" 3002 "Flexpa"
start_server "wallet-bwell" 3003 "b.well"
start_server "wallet-premera" 3004 "Premera"

# Wait a moment for servers to start
sleep 1

echo ""
echo "✓ All servers started!"
echo ""
echo "👉 Open http://requester.localhost:3000 to begin"
echo ""

# Wait for user to press Ctrl+C
wait
