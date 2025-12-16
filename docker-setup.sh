#!/usr/bin/env sh

set -e

echo "🚀 Reconned Docker Setup Script"
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is installed
if ! command -v docker >/dev/null 2>&1; then
    echo "${RED}❌ Error: Docker is not installed${NC}"
    echo "Please install Docker from https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is available
if ! docker compose version >/dev/null 2>&1; then
    echo "${RED}❌ Error: Docker Compose is not available${NC}"
    echo "Please install Docker Compose V2 or later"
    exit 1
fi

echo "${GREEN}✓ Docker and Docker Compose are installed${NC}"
echo ""

# Function to generate random secret
generate_secret() {
    # Generate a 64-character random string
    if command -v openssl >/dev/null 2>&1; then
        openssl rand -base64 48 | tr -d "=+/" | cut -c1-64
    else
        # Fallback for systems without openssl
        cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1
    fi
}

# Setup root .env for Docker Compose
echo "📝 Setting up Docker Compose environment..."
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "${GREEN}✓ Created .env from example${NC}"

        echo ""
        echo "${YELLOW}⚠ Configure your domain in .env:${NC}"
        echo "  - DOMAIN: Set to your domain (e.g., reconned.com or localhost for local dev)"
        echo "  - TRAEFIK_ACME_EMAIL: Set to your email for SSL certificate notifications"
        echo ""
    else
        echo "${RED}❌ Error: .env.example not found${NC}"
        exit 1
    fi
else
    echo "${YELLOW}⚠ .env already exists, skipping${NC}"
fi
echo ""

# Setup backend .env
echo "📝 Setting up backend environment..."
if [ ! -f "apps/backend/.env" ]; then
    if [ -f "apps/backend/.env.example" ]; then
        cp apps/backend/.env.example apps/backend/.env
        echo "${GREEN}✓ Created apps/backend/.env from example${NC}"

        # Generate secure secrets
        BETTER_AUTH_SECRET=$(generate_secret)

        # Update secrets in .env file (works on both Linux and macOS)
        if command -v sed >/dev/null 2>&1; then
            if sed --version >/dev/null 2>&1; then
                # GNU sed
                sed -i "s|BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}|g" apps/backend/.env
            else
                # BSD sed (macOS)
                sed -i '' "s|BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}|g" apps/backend/.env
            fi
            echo "${GREEN}✓ Generated secure BETTER_AUTH_SECRET${NC}"
        fi
    else
        echo "${RED}❌ Error: apps/backend/.env.example not found${NC}"
        exit 1
    fi
else
    echo "${YELLOW}⚠ apps/backend/.env already exists, skipping${NC}"
fi
echo ""

# Setup web .env
echo "📝 Setting up web environment..."
if [ ! -f "apps/web/.env" ]; then
    if [ -f "apps/web/.env.example" ]; then
        cp apps/web/.env.example apps/web/.env
        echo "${GREEN}✓ Created apps/web/.env from example${NC}"

        # Generate secure secrets
        BETTER_AUTH_SECRET=$(generate_secret)
        ADMIN_WEBHOOK_TOKEN=$(generate_secret)

        # Update secrets in .env file
        if command -v sed >/dev/null 2>&1; then
            if sed --version >/dev/null 2>&1; then
                # GNU sed
                sed -i "s|BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}|g" apps/web/.env
                sed -i "s|ADMIN_WEBHOOK_TOKEN=.*|ADMIN_WEBHOOK_TOKEN=${ADMIN_WEBHOOK_TOKEN}|g" apps/web/.env
            else
                # BSD sed (macOS)
                sed -i '' "s|BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}|g" apps/web/.env
                sed -i '' "s|ADMIN_WEBHOOK_TOKEN=.*|ADMIN_WEBHOOK_TOKEN=${ADMIN_WEBHOOK_TOKEN}|g" apps/web/.env
            fi
            echo "${GREEN}✓ Generated secure BETTER_AUTH_SECRET and ADMIN_WEBHOOK_TOKEN${NC}"
        fi
    else
        echo "${RED}❌ Error: apps/web/.env.example not found${NC}"
        exit 1
    fi
else
    echo "${YELLOW}⚠ apps/web/.env already exists, skipping${NC}"
fi
echo ""

echo "${YELLOW}⚠ Important: You need to configure the following:${NC}"
echo ""
echo "In .env (root directory):"
echo "  - DOMAIN: Your domain name (e.g., reconned.com or localhost)"
echo "  - TRAEFIK_ACME_EMAIL: Email for Let's Encrypt SSL certificates"
echo "  - POSTGRES_PASSWORD: Change the default password for production!"
echo ""
echo "In apps/backend/.env and apps/web/.env:"
echo "  - Google OAuth credentials (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)"
echo "  - S3 storage credentials (S3_ENDPOINT, S3_ACCESS_KEY_ID, etc.)"
echo "  - OneSignal push notification credentials"
echo "  - Cloudflare Turnstile keys"
echo "  - Other service credentials as needed"
echo ""
echo "See the respective .env files for details on each variable."
echo ""

# Ask if user wants to start services
echo "Would you like to start the Docker services now? (y/n)"
read -r response

if [ "$response" = "y" ] || [ "$response" = "Y" ]; then
    echo ""
    echo "🐳 Starting Docker services..."
    docker compose up -d

    echo ""
    echo "${GREEN}✓ Services are starting up!${NC}"
    echo ""
    echo "📊 Service Status:"
    docker compose ps
    echo ""
    echo "🔍 To view logs:"
    echo "  docker compose logs -f"
    echo ""
    echo "🌐 Access the application:"
    echo "  With Traefik (if DOMAIN is set):"
    echo "    Web:     https://\${DOMAIN}"
    echo "    Backend: https://\${DOMAIN}/api"
    echo ""
    echo "  Direct access (bypassing Traefik):"
    echo "    Web:     http://localhost:3000"
    echo "    Backend: http://localhost:4000"
    echo ""
    echo "  Note: For local development, you may need to add \${DOMAIN} to /etc/hosts"
    echo ""
    echo "📚 For more information, see DOCKER.md"
else
    echo ""
    echo "Setup complete! To start services later, run:"
    echo "  docker compose up -d"
    echo ""
    echo "📚 For more information, see DOCKER.md"
fi

echo ""
echo "${GREEN}✨ Setup complete!${NC}"
