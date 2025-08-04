#!/usr/bin/env node

/**
 * Script to fix ESM imports in compiled TypeScript files
 * Adds .js extensions to relative imports
 */

const fs = require('fs').promises;
const path = require('path');

async function* walkDir(dir) {
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  for (const dirent of dirents) {
    const res = path.resolve(dir, dirent.name);
    if (dirent.isDirectory()) {
      yield* walkDir(res);
    } else if (dirent.name.endsWith('.js')) {
      yield res;
    }
  }
}

async function fixImportsInFile(filePath) {
  let content = await fs.readFile(filePath, 'utf8');
  
  // Fix relative imports - add .js extension
  const relativeImportRegex = /from\s+['"](\.[^'"]+)['"];?/g;
  let modified = false;
  
  content = content.replace(relativeImportRegex, (match, importPath) => {
    // Skip if already has extension
    if (importPath.endsWith('.js') || importPath.endsWith('.json')) {
      return match;
    }
    
    // Skip if it's a directory import (ends with /)
    if (importPath.endsWith('/')) {
      return match;
    }
    
    modified = true;
    return match.replace(importPath, importPath + '.js');
  });
  
  // Fix shared module imports
  const sharedImportRegex = /from\s+['"](\.\.\/)+(shared\/types)(\.js)?['"];?/g;
  content = content.replace(sharedImportRegex, (match, dots, sharedPath, ext) => {
    modified = true;
    const newPath = match.replace(sharedPath, 'shared/dist/types/index');
    // Ensure .js extension is present
    if (!newPath.includes('.js')) {
      return newPath.replace(/['"]/, '.js$&');
    }
    return newPath;
  });
  
  // Fix dynamic imports
  const dynamicImportRegex = /import\(['"](\.[^'"]+)['"]\)/g;
  content = content.replace(dynamicImportRegex, (match, importPath) => {
    if (importPath.endsWith('.js') || importPath.endsWith('.json')) {
      return match;
    }
    modified = true;
    return match.replace(importPath, importPath + '.js');
  });
  
  if (modified) {
    await fs.writeFile(filePath, content);
    console.log(`Fixed imports in: ${path.relative(process.cwd(), filePath)}`);
  }
}

async function main() {
  const distDir = path.join(process.cwd(), 'dist');
  
  try {
    await fs.access(distDir);
  } catch (error) {
    console.error('dist directory not found');
    process.exit(1);
  }
  
  console.log('Fixing ESM imports in dist directory...');
  
  for await (const filePath of walkDir(distDir)) {
    await fixImportsInFile(filePath);
  }
  
  console.log('Done fixing imports!');
}

main().catch(console.error);
