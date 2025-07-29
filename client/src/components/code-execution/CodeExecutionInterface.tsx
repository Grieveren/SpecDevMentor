import React, { useState, useCallback } from 'react';
import { CodeEditor } from './CodeEditor';
import { ExecutionResults } from './ExecutionResults';
import { ComplianceFeedback } from './ComplianceFeedback';
import { codeExecutionService } from '../../services/code-execution.service';
import { 
  SupportedLanguage, 
  ExecutionResult, 
  ComplianceResult,
  SpecificationDocument,
  CodeExecutionState,
  ComplianceValidationState
} from '../../types/code-execution';
import { 
  PlayIcon, 
  CheckBadgeIcon, 
  Cog6ToothIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';

interface CodeExecutionInterfaceProps {
  specifications?: SpecificationDocument[];
  initialCode?: string;
  initialLanguage?: SupportedLanguage;
  className?: string;
}

export const CodeExecutionInterface: React.FC<CodeExecutionInterfaceProps> = ({
  specifications = [],
  initialCode = '',
  initialLanguage = SupportedLanguage.JAVASCRIPT,
  className = '',
}) => {
  const [code, setCode] = useState(initialCode);
  const [language, setLanguage] = useState(initialLanguage);
  const [input, setInput] = useState('');
  const [timeout, setTimeout] = useState(30);
  const [activeTab, setActiveTab] = useState<'execution' | 'compliance'>('execution');

  const [executionState, setExecutionState] = useState<CodeExecutionState>({
    isExecuting: false,
    result: null,
    error: null,
  });

  const [complianceState, setComplianceState] = useState<ComplianceValidationState>({
    isValidating: false,
    result: null,
    error: null,
  });

  const executeCode = useCallback(async () => {
    if (!code.trim()) {
      return;
    }

    setExecutionState({
      isExecuting: true,
      result: null,
      error: null,
    });

    try {
      const _result = await codeExecutionService.executeCode({
        code,
        language,
        input: input || undefined,
        timeout: timeout * 1000, // Convert to milliseconds
      });

      setExecutionState({
        isExecuting: false,
        result,
        error: null,
      });
    } catch (error) {
      setExecutionState({
        isExecuting: false,
        result: null,
        error: error instanceof Error ? error.message : 'Execution failed',
      });
    }
  }, [code, language, input, timeout]);

  const validateCompliance = useCallback(async () => {
    if (!code.trim() || specifications.length === 0) {
      return;
    }

    setComplianceState({
      isValidating: true,
      result: null,
      error: null,
    });

    try {
      const _result = await codeExecutionService.validateCompliance(
        code,
        language,
        specifications
      );

      setComplianceState({
        isValidating: false,
        result,
        error: null,
      });
    } catch (error) {
      setComplianceState({
        isValidating: false,
        result: null,
        error: error instanceof Error ? error.message : 'Compliance validation failed',
      });
    }
  }, [code, language, specifications]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      executeCode();
    }
  }, [executeCode]);

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`} onKeyDown={handleKeyDown}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Code Execution & Validation</h2>
          <div className="flex items-center space-x-2">
            <Cog6ToothIcon className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-600">
              Press Ctrl+Enter to execute
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
        {/* Left Column - Code Editor */}
        <div className="space-y-4">
          <CodeEditor
            value={code}
            onChange={setCode}
            language={language}
            onLanguageChange={setLanguage}
            disabled={executionState.isExecuting || complianceState.isValidating}
          />

          {/* Input Section */}
          <div>
            <label htmlFor="code-input" className="block text-sm font-medium text-gray-700 mb-2">
              Input (optional):
            </label>
            <textarea
              id="code-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter input for your program..."
              disabled={executionState.isExecuting || complianceState.isValidating}
              className="w-full h-20 p-3 border border-gray-300 rounded-md text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>

          {/* Settings */}
          <div className="flex items-center space-x-4">
            <div>
              <label htmlFor="timeout" className="block text-sm font-medium text-gray-700 mb-1">
                Timeout (seconds):
              </label>
              <input
                id="timeout"
                type="number"
                min="1"
                max="120"
                value={timeout}
                onChange={(e) => setTimeout(parseInt(e.target.value) || 30)}
                disabled={executionState.isExecuting || complianceState.isValidating}
                className="w-20 p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-3">
            <button
              onClick={executeCode}
              disabled={!code.trim() || executionState.isExecuting || complianceState.isValidating}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              <PlayIcon className="w-4 h-4" />
              <span>{executionState.isExecuting ? 'Executing...' : 'Execute Code'}</span>
            </button>

            {specifications.length > 0 && (
              <button
                onClick={validateCompliance}
                disabled={!code.trim() || executionState.isExecuting || complianceState.isValidating}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                <CheckBadgeIcon className="w-4 h-4" />
                <span>{complianceState.isValidating ? 'Validating...' : 'Validate Compliance'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Column - Results */}
        <div className="space-y-4">
          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('execution')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'execution'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <PlayIcon className="w-4 h-4" />
                  <span>Execution Results</span>
                </div>
              </button>

              {specifications.length > 0 && (
                <button
                  onClick={() => setActiveTab('compliance')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'compliance'
                      ? 'border-green-500 text-green-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <DocumentTextIcon className="w-4 h-4" />
                    <span>Compliance Report</span>
                  </div>
                </button>
              )}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="min-h-96">
            {activeTab === 'execution' && (
              <div>
                {executionState.result && (
                  <ExecutionResults
                    result={executionState.result}
                    isLoading={executionState.isExecuting}
                  />
                )}
                {executionState.error && (
                  <div className="border border-red-200 bg-red-50 rounded-lg p-4">
                    <div className="flex items-center space-x-2 text-red-700">
                      <span className="font-medium">Execution Error:</span>
                    </div>
                    <p className="text-red-600 text-sm mt-1">{executionState.error}</p>
                  </div>
                )}
                {!executionState.result && !executionState.error && !executionState.isExecuting && (
                  <div className="border border-gray-200 rounded-lg p-8 text-center text-gray-500">
                    <PlayIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>Click "Execute Code" to run your program</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'compliance' && specifications.length > 0 && (
              <div>
                {complianceState.result && (
                  <ComplianceFeedback
                    result={complianceState.result}
                    isLoading={complianceState.isValidating}
                  />
                )}
                {complianceState.error && (
                  <div className="border border-red-200 bg-red-50 rounded-lg p-4">
                    <div className="flex items-center space-x-2 text-red-700">
                      <span className="font-medium">Validation Error:</span>
                    </div>
                    <p className="text-red-600 text-sm mt-1">{complianceState.error}</p>
                  </div>
                )}
                {!complianceState.result && !complianceState.error && !complianceState.isValidating && (
                  <div className="border border-gray-200 rounded-lg p-8 text-center text-gray-500">
                    <DocumentTextIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>Click "Validate Compliance" to check your code against specifications</p>
                    <p className="text-sm mt-2">
                      {specifications.length} specification document{specifications.length !== 1 ? 's' : ''} loaded
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};