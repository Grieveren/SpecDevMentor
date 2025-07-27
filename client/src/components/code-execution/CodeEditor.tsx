import React, { useState, useCallback } from 'react';
import { SupportedLanguage } from '../../types/code-execution';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: SupportedLanguage;
  onLanguageChange: (language: SupportedLanguage) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const LANGUAGE_OPTIONS = [
  { value: SupportedLanguage.JAVASCRIPT, label: 'JavaScript' },
  { value: SupportedLanguage.TYPESCRIPT, label: 'TypeScript' },
  { value: SupportedLanguage.PYTHON, label: 'Python' },
  { value: SupportedLanguage.JAVA, label: 'Java' },
  { value: SupportedLanguage.GO, label: 'Go' },
  { value: SupportedLanguage.RUST, label: 'Rust' },
];

const LANGUAGE_EXAMPLES: Record<SupportedLanguage, string> = {
  [SupportedLanguage.JAVASCRIPT]: `// JavaScript Example
function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet('World'));`,

  [SupportedLanguage.TYPESCRIPT]: `// TypeScript Example
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

console.log(greet('World'));`,

  [SupportedLanguage.PYTHON]: `# Python Example
def greet(name):
    return f"Hello, {name}!"

print(greet('World'))`,

  [SupportedLanguage.JAVA]: `// Java Example
public class Main {
    public static void main(String[] args) {
        System.out.println(greet("World"));
    }
    
    public static String greet(String name) {
        return "Hello, " + name + "!";
    }
}`,

  [SupportedLanguage.GO]: `// Go Example
package main

import "fmt"

func greet(name string) string {
    return fmt.Sprintf("Hello, %s!", name)
}

func main() {
    fmt.Println(greet("World"))
}`,

  [SupportedLanguage.RUST]: `// Rust Example
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}

fn main() {
    println!("{}", greet("World"));
}`,
};

export const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  language,
  onLanguageChange,
  placeholder,
  disabled = false,
  className = '',
}) => {
  const [showExample, setShowExample] = useState(false);

  const handleLanguageChange = useCallback((newLanguage: SupportedLanguage) => {
    onLanguageChange(newLanguage);
    if (!value.trim()) {
      setShowExample(true);
    }
  }, [value, onLanguageChange]);

  const loadExample = useCallback(() => {
    onChange(LANGUAGE_EXAMPLES[language]);
    setShowExample(false);
  }, [language, onChange]);

  const clearEditor = useCallback(() => {
    onChange('');
    setShowExample(false);
  }, [onChange]);

  return (
    <div className={`border border-gray-300 rounded-lg overflow-hidden ${className}`}>
      {/* Editor Header */}
      <div className="bg-gray-50 border-b border-gray-300 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <label htmlFor="language-select" className="text-sm font-medium text-gray-700">
            Language:
          </label>
          <select
            id="language-select"
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value as SupportedLanguage)}
            disabled={disabled}
            className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-2">
          {!value.trim() && (
            <button
              onClick={loadExample}
              disabled={disabled}
              className="text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400"
            >
              Load Example
            </button>
          )}
          {value.trim() && (
            <button
              onClick={clearEditor}
              disabled={disabled}
              className="text-sm text-red-600 hover:text-red-800 disabled:text-gray-400"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Code Editor */}
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || `Enter your ${language} code here...`}
          disabled={disabled}
          className="w-full h-96 p-4 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
          style={{
            tabSize: 2,
            lineHeight: '1.5',
          }}
          onKeyDown={(e) => {
            // Handle tab key for indentation
            if (e.key === 'Tab') {
              e.preventDefault();
              const start = e.currentTarget.selectionStart;
              const end = e.currentTarget.selectionEnd;
              const newValue = value.substring(0, start) + '  ' + value.substring(end);
              onChange(newValue);
              
              // Set cursor position after the inserted spaces
              setTimeout(() => {
                e.currentTarget.selectionStart = e.currentTarget.selectionEnd = start + 2;
              }, 0);
            }
          }}
        />

        {/* Line numbers (simple implementation) */}
        <div className="absolute left-0 top-0 p-4 pointer-events-none text-gray-400 font-mono text-sm select-none">
          {value.split('\n').map((_, index) => (
            <div key={index} style={{ lineHeight: '1.5' }}>
              {index + 1}
            </div>
          ))}
        </div>

        {/* Syntax highlighting overlay would go here in a real implementation */}
      </div>

      {/* Editor Footer */}
      <div className="bg-gray-50 border-t border-gray-300 px-4 py-2 text-xs text-gray-600">
        <div className="flex items-center justify-between">
          <span>
            Lines: {value.split('\n').length} | Characters: {value.length}
          </span>
          <span>
            Press Tab for indentation
          </span>
        </div>
      </div>
    </div>
  );
};