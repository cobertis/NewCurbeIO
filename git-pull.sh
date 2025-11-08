#!/bin/bash

# Git Pull Script for Replit
# Uses GIT_URL secret for persistent authentication

set -e

# Check if GIT_URL secret is configured
if [ -z "$GIT_URL" ]; then
    echo "❌ ERROR: GIT_URL secret not configured"
    echo "See GITHUB_SETUP.md for setup instructions"
    exit 1
fi

echo "⬇️  Pulling from GitHub..."
git pull "$GIT_URL" main 2>&1 | grep -v "https://" || true

echo "✅ Successfully pulled from GitHub!"
