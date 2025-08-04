#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Error patterns and their fixes
const errorPatterns = {
  // Pattern 1: Variable name mismatches (file -> _file, document -> _document)
  variableNameMismatch: {
    pattern: /Cannot find name '(file|document)'\. Did you mean '_\1'\?/,
    fix: (content, match) => {
      const varName = match[1];
      const correctName = '_' + varName;
      // Replace standalone occurrences of the incorrect variable name
      const regex = new RegExp(`\\b${varName}\\b(?![_a-zA-Z0-9])`, 'g');
      return content.replace(regex, correctName);
    }
  },
  
  // Pattern 2: Type 'string | null' to 'string | undefined'
  nullToUndefined: {
    pattern: /Type 'string \| null' is not assignable to type 'string \| undefined'/,
    fix: (content, lineNumber) => {
      // Convert null assignments to undefined
      const lines = content.split('\n');
      if (lines[lineNumber - 1]) {
        lines[lineNumber - 1] = lines[lineNumber - 1].replace(/:\s*null/g, ': undefined');
      }
      return lines.join('\n');
    }
  },
  
  // Pattern 3: Possibly null checks
  possiblyNull: {
    pattern: /'([^']+)' is possibly 'null'/,
    fix: (content, match, lineNumber) => {
      const varName = match[1];
      const lines = content.split('\n');
      if (lines[lineNumber - 1]) {
        // Add null check
        const line = lines[lineNumber - 1];
        const indentation = line.match(/^\s*/)[0];
        
        // Check if it's already inside an if statement
        if (!line.trim().startsWith('if')) {
          lines[lineNumber - 1] = `${indentation}if (${varName}) {\n${indentation}  ${line.trim()}\n${indentation}}`;
        }
      }
      return lines.join('\n');
    }
  }
};

// Parse TypeScript error log
function parseErrorLog(logPath) {
  const content = fs.readFileSync(logPath, 'utf8');
  const errors = [];
  
  content.split('\n').forEach(line => {
    const match = line.match(/^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/);
    if (match) {
      errors.push({
        file: match[1],
        line: parseInt(match[2]),
        column: parseInt(match[3]),
        code: match[4],
        message: match[5]
      });
    }
  });
  
  return errors;
}

// Group errors by file
function groupErrorsByFile(errors) {
  const grouped = {};
  errors.forEach(error => {
    if (!grouped[error.file]) {
      grouped[error.file] = [];
    }
    grouped[error.file].push(error);
  });
  return grouped;
}

// Apply fixes to a file
function applyFixes(filePath, errors) {
  const fullPath = path.join(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`File not found: ${fullPath}`);
    return;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  const originalContent = content;
  let fixCount = 0;
  
  // Sort errors by line number in reverse order to avoid line number shifts
  errors.sort((a, b) => b.line - a.line);
  
  errors.forEach(error => {
    for (const [patternName, patternConfig] of Object.entries(errorPatterns)) {
      const match = error.message.match(patternConfig.pattern);
      if (match) {
        console.log(`Applying ${patternName} fix to ${filePath}:${error.line}`);
        content = patternConfig.fix(content, match, error.line);
        fixCount++;
        break;
      }
    }
  });
  
  if (content !== originalContent) {
    // Backup original file
    fs.writeFileSync(`${fullPath}.backup`, originalContent);
    // Write fixed content
    fs.writeFileSync(fullPath, content);
    console.log(`Fixed ${fixCount} errors in ${filePath}`);
  }
}

// Main execution
function main() {
  const errorLogPath = path.join(process.cwd(), 'server-typescript-errors.log');
  
  if (!fs.existsSync(errorLogPath)) {
    console.error('Error log not found. Please run TypeScript compiler first.');
    process.exit(1);
  }
  
  console.log('Parsing TypeScript errors...');
  const errors = parseErrorLog(errorLogPath);
  console.log(`Found ${errors.length} errors`);
  
  const groupedErrors = groupErrorsByFile(errors);
  
  console.log('\nApplying automated fixes...');
  for (const [file, fileErrors] of Object.entries(groupedErrors)) {
    applyFixes(file, fileErrors);
  }
  
  console.log('\nAutomated fixes complete. Please run TypeScript compiler again to check remaining errors.');
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { parseErrorLog, groupErrorsByFile, applyFixes };
