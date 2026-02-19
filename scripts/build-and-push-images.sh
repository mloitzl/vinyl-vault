#!/bin/bash
# Build and push Docker images locally to GHCR
# Usage: ./scripts/build-and-push-images.sh [tag] [services...]
#
# Examples:
#   ./scripts/build-and-push-images.sh                    # Build all, tag with commit SHA
#   ./scripts/build-and-push-images.sh my-feature         # Build all, tag with "my-feature"
#   ./scripts/build-and-push-images.sh latest backend bff # Build backend & bff, tag as "latest"

set -e

# Configuration
REGISTRY="ghcr.io"
OWNER="mloitzl"
SERVICES=("backend" "bff" "frontend")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
CUSTOM_TAG="${1}"
if [ -n "$CUSTOM_TAG" ]; then
  shift
  if [ $# -gt 0 ]; then
    SERVICES=("$@")
  fi
fi

# Auto-detect tag if not provided
if [ -z "$CUSTOM_TAG" ]; then
  BRANCH=$(git branch --show-current)
  COMMIT_SHA=$(git rev-parse --short HEAD)
  
  if [ "$BRANCH" = "main" ]; then
    TAG="latest-production"
  elif [ "$BRANCH" = "develop" ]; then
    TAG="latest-staging"
  else
    TAG="$COMMIT_SHA"
  fi
  
  echo -e "${BLUE}📌 Auto-detected tag from branch '$BRANCH': ${TAG}${NC}"
else
  TAG="$CUSTOM_TAG"
  echo -e "${BLUE}📌 Using custom tag: ${TAG}${NC}"
fi

echo -e "${BLUE}🏗️  Building services: ${SERVICES[*]}${NC}"
echo ""

# Check if logged in to GHCR
echo -e "${YELLOW}🔐 Checking GitHub Container Registry login...${NC}"
DOCKER_CONFIG_PATH="${DOCKER_CONFIG:-$HOME/.docker}/config.json"
if [ ! -f "$DOCKER_CONFIG_PATH" ] || ! grep -q '"ghcr.io"' "$DOCKER_CONFIG_PATH"; then
  echo -e "${YELLOW}Not logged in to GHCR. Please login first:${NC}"
  echo ""
  echo "  1. Create a GitHub Personal Access Token with 'write:packages' scope:"
  echo "     https://github.com/settings/tokens/new?scopes=write:packages"
  echo ""
  echo "  2. Login to GHCR:"
  echo "     echo \$GITHUB_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin"
  echo ""
  read -p "Have you logged in? Press enter to continue or Ctrl+C to cancel..."
fi

# Function to build and push a service
build_and_push() {
  local service=$1
  local image_name="${REGISTRY}/${OWNER}/vinylvault-${service}"
  local image_tag="${image_name}:${TAG}"
  local commit_sha=$(git rev-parse --short HEAD)
  local commit_tag="${image_name}:${commit_sha}"
  
  echo ""
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}📦 Building: ${service}${NC}"
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  
  # Build the image
  echo -e "${BLUE}🔨 Building ${service}...${NC}"
  docker build \
    -f "./infra/Dockerfile.${service}" \
    -t "${image_tag}" \
    -t "${commit_tag}" \
    . || {
      echo -e "${RED}❌ Failed to build ${service}${NC}"
      return 1
    }
  
  echo -e "${GREEN}✓ Built: ${image_tag}${NC}"
  echo -e "${GREEN}✓ Built: ${commit_tag}${NC}"
  
  # Push the images
  echo ""
  echo -e "${BLUE}📤 Pushing ${service} to registry...${NC}"
  docker push "${image_tag}" || {
    echo -e "${RED}❌ Failed to push ${image_tag}${NC}"
    return 1
  }
  
  # Also push commit tag
  docker push "${commit_tag}" || {
    echo -e "${YELLOW}⚠️  Warning: Failed to push ${commit_tag}${NC}"
  }
  
  echo -e "${GREEN}✓ Pushed: ${image_tag}${NC}"
  echo -e "${GREEN}✓ Pushed: ${commit_tag}${NC}"
  
  return 0
}

# Build and push each service
FAILED_SERVICES=()
SUCCESSFUL_SERVICES=()

for service in "${SERVICES[@]}"; do
  if build_and_push "$service"; then
    SUCCESSFUL_SERVICES+=("$service")
  else
    FAILED_SERVICES+=("$service")
  fi
done

# Summary
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}📊 Build Summary${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}Tag: ${TAG}${NC}"
echo ""

if [ ${#SUCCESSFUL_SERVICES[@]} -gt 0 ]; then
  echo -e "${GREEN}✅ Successful (${#SUCCESSFUL_SERVICES[@]}):${NC}"
  for service in "${SUCCESSFUL_SERVICES[@]}"; do
    echo "   - ${service}"
  done
  echo ""
fi

if [ ${#FAILED_SERVICES[@]} -gt 0 ]; then
  echo -e "${RED}❌ Failed (${#FAILED_SERVICES[@]}):${NC}"
  for service in "${FAILED_SERVICES[@]}"; do
    echo "   - ${service}"
  done
  echo ""
  exit 1
fi

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}🎉 All images built and pushed successfully!${NC}"
echo ""
echo "Next steps:"
echo "  1. Deploy to staging: ./scripts/deploy-branch-to-staging.sh"
echo "  2. Or manually: kubectl set image deployment/SERVICE SERVICE=IMAGE:TAG -n vinylvault-staging"
echo ""

# Show all tags pushed
echo "Images pushed:"
for service in "${SUCCESSFUL_SERVICES[@]}"; do
  echo "  - ${REGISTRY}/${OWNER}/vinylvault-${service}:${TAG}"
done
echo ""
