#!/bin/bash

# Test static build in single-origin mode (like GitHub Pages)
# This serves the built demo site from one origin

echo "🔨 Building project..."
bun build.ts

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
bunx http-server -p 8080 -c-1
