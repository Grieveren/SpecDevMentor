#!/bin/bash

# Script to fix router type inference errors in all route files

# Find all route files
ROUTE_FILES=$(find /Users/brettgray/Coding/SpecDevMentor/server/src/routes -name "*.routes.ts" -not -name "auth.routes.ts")

# Fix each route file
for file in $ROUTE_FILES; do
    echo "Fixing $file..."
    
    # Add ExpressRouter type import if not present
    if ! grep -q "import type { Router as ExpressRouter }" "$file"; then
        # Add the type import after the express import
        sed -i '' '/^import.*Router.*from.*express/a\
import type { Router as ExpressRouter } from '\''express'\'';' "$file"
    fi
    
    # Replace "const router = Router();" with typed version
    sed -i '' 's/const router = Router();/const router: ExpressRouter = Router();/g' "$file"
    
    # Fix function exports that return routers
    # For createAuthRoutes pattern
    sed -i '' 's/export const create\([A-Za-z]*\)Routes = \(.*\) => {/export const create\1Routes = \2: ExpressRouter => {/g' "$file"
    
    # For initializeRoutes pattern  
    sed -i '' 's/export const initialize\([A-Za-z]*\)Routes = \(.*\) => {/export const initialize\1Routes = \2: ExpressRouter => {/g' "$file"
done

# Fix production-server.ts and simple-server.ts
echo "Fixing server files..."

# Fix production-server.ts
sed -i '' '/^const app = express();/i\
import type { Application } from '\''express'\'';' /Users/brettgray/Coding/SpecDevMentor/server/src/production-server.ts
sed -i '' 's/const app = express();/const app: Application = express();/g' /Users/brettgray/Coding/SpecDevMentor/server/src/production-server.ts

# Fix simple-server.ts
sed -i '' '/^const app = express();/i\
import type { Application } from '\''express'\'';' /Users/brettgray/Coding/SpecDevMentor/server/src/simple-server.ts
sed -i '' 's/const app = express();/const app: Application = express();/g' /Users/brettgray/Coding/SpecDevMentor/server/src/simple-server.ts

echo "Done fixing router type inference errors!"
