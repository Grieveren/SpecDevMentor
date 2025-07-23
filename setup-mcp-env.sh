#!/bin/bash

echo "🔧 Setting up MCP Environment Variables"
echo "======================================="

# GitHub Token Setup
echo ""
echo "1. GitHub Personal Access Token"
echo "   Go to: https://github.com/settings/tokens"
echo "   Create a new token with 'repo' and 'public_repo' scopes"
echo ""
read -p "Enter your GitHub token (or press Enter to skip): " GITHUB_TOKEN

if [ ! -z "$GITHUB_TOKEN" ]; then
    echo "export GITHUB_PERSONAL_ACCESS_TOKEN=\"$GITHUB_TOKEN\"" >> ~/.zshrc
    echo "✅ GitHub token added to ~/.zshrc"
fi

# PostgreSQL Connection
echo ""
echo "2. PostgreSQL Connection String"
echo "   Format: postgresql://username:password@host:port/database"
echo "   Example: postgresql://user:pass@localhost:5432/codementor_ai"
echo ""
read -p "Enter your PostgreSQL connection string (or press Enter to skip): " POSTGRES_URL

if [ ! -z "$POSTGRES_URL" ]; then
    echo "export POSTGRES_CONNECTION_STRING=\"$POSTGRES_URL\"" >> ~/.zshrc
    echo "✅ PostgreSQL connection added to ~/.zshrc"
fi

# Brave Search API
echo ""
echo "3. Brave Search API Key (Optional)"
echo "   Go to: https://brave.com/search/api/"
echo "   Sign up for free (2,000 queries/month)"
echo ""
read -p "Enter your Brave API key (or press Enter to skip): " BRAVE_KEY

if [ ! -z "$BRAVE_KEY" ]; then
    echo "export BRAVE_API_KEY=\"$BRAVE_KEY\"" >> ~/.zshrc
    echo "✅ Brave API key added to ~/.zshrc"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Run: source ~/.zshrc"
echo "2. Restart Kiro to load the MCP servers"
echo "3. Test the MCP connections"
echo ""
echo "Note: You can always edit ~/.zshrc manually to update these values"