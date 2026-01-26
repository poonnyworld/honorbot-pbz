#!/bin/bash

# Script to setup Docker registry mirror
# This will help resolve TLS handshake timeout issues when pulling images

echo "Setting up Docker registry mirror..."

# Create docker directory if it doesn't exist
sudo mkdir -p /etc/docker

# Backup existing daemon.json if it exists
if [ -f /etc/docker/daemon.json ]; then
    echo "Backing up existing daemon.json..."
    sudo cp /etc/docker/daemon.json /etc/docker/daemon.json.backup.$(date +%Y%m%d_%H%M%S)
fi

# Copy the new configuration
echo "Installing new Docker daemon configuration..."
sudo cp docker-daemon.json /etc/docker/daemon.json

# Set proper permissions
sudo chmod 644 /etc/docker/daemon.json

# Restart Docker service
echo "Restarting Docker service..."
sudo systemctl restart docker

# Wait a moment for Docker to restart
sleep 3

# Verify the configuration
echo ""
echo "Verifying Docker configuration..."
docker info 2>&1 | grep -A 5 "Registry Mirrors" || echo "Registry mirrors configured"

echo ""
echo "✅ Docker registry mirror setup complete!"
echo ""
echo "You can now try building again with:"
echo "  docker-compose up --build -d"
echo ""
echo "Or test pulling an image:"
echo "  docker pull node:18"
