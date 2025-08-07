/*
  Utility to normalize test variables across server tests.
  - Replaces _result/_response/_request/_document with result/response/request/document
  - Inserts `let result/response/request/document: any;` in the outermost describe block if assignment is used but declaration is missing
*/
const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, '..', 'server', 'src', '__tests__');

function walk(dir, handler) {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, handler);
    else if (full.endsWith('.ts')) handler(full);
  }
}

function replaceUnderscoredVars(text) {
  return text
    .replace(/\b_result\b/g, 'result')
    .replace(/\b_response\b/g, 'response')
    .replace(/\b_request\b/g, 'request')
    .replace(/\b_document\b/g, 'document');
}

function ensureVarDeclaration(text, varName) {
  const assignRegex = new RegExp(`(^|\\n)\\s*${varName}\\s*=`, 'm');
  const declRegex = new RegExp(`\\b(?:let|const)\\s+${varName}\\b`);
  if (assignRegex.test(text) && !declRegex.test(text)) {
    // Prefer inserting after the last import statement
    const importRegex = /(^(?:import\s.+\n)+)/m;
    const match = text.match(importRegex);
    if (match) {
      const insertion = `${match[0]}\nlet ${varName}: any;\n`;
      return text.replace(importRegex, insertion);
    }
    // Fallback: insert after first describe
    return text.replace(/describe\s*\([^)]*\)\s*=>\s*\{/, (m) => `${m}\n  let ${varName}: any;`);
  }
  return text;
}

function processFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  let updated = content;

  // Normalize underscored variables
  updated = replaceUnderscoredVars(updated);

  // Guard declarations
  for (const name of ['result', 'response', 'request', 'document']) {
    updated = ensureVarDeclaration(updated, name);
  }

  if (updated !== content) {
    fs.writeFileSync(file, updated, 'utf8');
    console.log('Updated', file);
  }
}

walk(baseDir, processFile);

