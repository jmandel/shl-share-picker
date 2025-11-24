#!/bin/bash

# Test static build in single-origin mode (like GitHub Pages)
# This serves the entire directory from one origin with the same path structure as GitHub Pages

echo "🔨 Building project..."
./build.sh

echo ""
echo "📦 Creating build directory with GitHub Pages structure..."
rm -rf build
mkdir -p build/smart-health-checkin-demo

# Copy all files except build directory itself
rsync -av --exclude='build' --exclude='.git' --exclude='node_modules' --exclude='test-results' . build/smart-health-checkin-demo/

echo ""
echo "🚀 Starting static server in single-origin mode..."
echo ""
echo "This simulates GitHub Pages deployment at:"
echo "  • Main:      http://localhost:8080/smart-health-checkin-demo/"
echo "  • Requester: http://localhost:8080/smart-health-checkin-demo/requester/"
echo "  • Check-in:  http://localhost:8080/smart-health-checkin-demo/checkin/"
echo "  • Flexpa:    http://localhost:8080/smart-health-checkin-demo/source-flexpa/"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

cd build
bunx http-server -p 8080
