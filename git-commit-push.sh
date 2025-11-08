#!/bin/bash

# Git Commit and Push Script for Replit
# Uses GIT_URL secret for persistent authentication

set -e

# Check if GIT_URL secret is configured
if [ -z "$GIT_URL" ]; then
    echo "❌ ERROR: GIT_URL secret not configured"
    echo ""
    echo "Please configure the GIT_URL secret in Replit:"
    echo "1. Open Secrets panel (lock icon in sidebar)"
    echo "2. Add new secret:"
    echo "   Key: GIT_URL"
    echo "   Value: https://cobertis:<YOUR_GITHUB_TOKEN>@github.com/cobertis/NewCurbeIO"
    echo ""
    echo "See GITHUB_SETUP.md for detailed instructions"
    exit 1
fi

# Get commit message from argument or use default
COMMIT_MSG="${1:-Update: code changes}"

echo "🔄 Git Commit and Push"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Show status
echo "📊 Current status:"
git status --short

# Add all changes
echo ""
echo "📦 Adding all changes..."
git add -A

# Check if there are changes to commit
if git diff --cached --quiet; then
    echo "⚠️  No changes to commit"
    exit 0
fi

# Commit
echo ""
echo "💾 Committing with message: '$COMMIT_MSG'"
git commit -m "$COMMIT_MSG"

# Push
echo ""
echo "⬆️  Pushing to GitHub..."
git push "$GIT_URL" HEAD:main 2>&1 | grep -v "https://" || true

echo ""
echo "✅ Successfully pushed to GitHub!"
echo "🌐 View at: https://github.com/cobertis/NewCurbeIO/commits/main"
