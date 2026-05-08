#!/bin/bash

# yosem.vip SSL Setup Script
# This script installs certbot and obtains a certificate for yosem.vip

set -e

# 1. Install Certbot
echo "Installing Certbot..."
sudo apt update
sudo apt install -y certbot python3-certbot-nginx

# 2. Obtain Certificate
# This will automatically modify Nginx if you choose, or just get the certs
echo "Requesting SSL certificate for yosem.vip and www.yosem.vip..."
sudo certbot certonly --nginx -d yosem.vip -d www.yosem.vip --non-interactive --agree-tos --email webmaster@yosem.vip

# 3. Create directory for self-signed fallback if needed (optional)
# sudo mkdir -p /etc/letsencrypt/live/yosem.vip/

# 4. Reload Nginx
echo "Reloading Nginx..."
sudo systemctl reload nginx

echo "SSL Setup Complete!"
