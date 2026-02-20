#!/bin/bash
# Run backend with venv (Linux/macOS). Use from project root or from backend folder.
cd "$(dirname "$0")"
if [ ! -f venv/bin/activate ]; then
    echo "Creating venv..."
    python3 -m venv venv
fi
source venv/bin/activate
echo "Starting backend (venv active)..."
python start_server.py
