import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CodeExecutionInterface } from '../CodeExecutionInterface';
import { SupportedLanguage } from '../../../types/code-execution';
import { codeExecutionService } from '../../../services/code-execution.service';

// Mock the code execution service
vi.mock('../../../services/code-execution.service', () => ({
  codeExecutionService: {
    executeCode: vi.fn(),
    validateCompliance: vi.fn(),
    getSupportedLanguages: vi.fn(),
    getSystemStatus: vi.fn(),
  },
}));

const mockExecutionResult = {
  success: true,
  output: 'Hello, World!',
  error: null,
  executionTime: 150,
  exitCode: 0,
  timedOut: false,
};

const mockComplianceResult = {
  score: 85,
  passed: true,
  details: [
    {
      requirement: 'Function should return greeting',
      status: 'passed' as const,
      message: 'Requirement fully implemented (90% match)',
      evidence: 'Found function: greet',
    },
  ],
  suggestions: ['Consider adding input validation'],
};

const mockSpecifications = [
  {
    id: 'req-1',
    content: 'WHEN user calls greet function THEN system SHALL return greeting message',
    phase: 'requirements' as const,
  },
];

describe('CodeExecutionInterface', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with default state', () => {
    render(<CodeExecutionInterface />);

    expect(screen.getByText('Code Execution & Validation')).toBeInTheDocument();
    expect(screen.getByText('Execute Code')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveValue('javascript');
    expect(screen.getByPlaceholderText(/Enter your javascript code here/)).toBeInTheDocument();
  });

  it('should allow code input and language selection', async () => {
    render(<CodeExecutionInterface />);

    const codeEditor = screen.getByPlaceholderText(/Enter your javascript code here/);
    const languageSelect = screen.getByRole('combobox');

    // Type code
    await user.type(codeEditor, 'console.log("Hello, World!");');
    expect(codeEditor).toHaveValue('console.log("Hello, World!");');

    // Change language
    await user.selectOptions(languageSelect, SupportedLanguage.PYTHON);
    expect(languageSelect).toHaveValue(SupportedLanguage.PYTHON);
  });

  it('should execute code when Execute Code button is clicked', async () => {
    const mockExecuteCode = vi.mocked(codeExecutionService.executeCode);
    mockExecuteCode.mockResolvedValue(mockExecutionResult);

    render(<CodeExecutionInterface />);

    const codeEditor = screen.getByPlaceholderText(/Enter your javascript code here/);
    const executeButton = screen.getByText('Execute Code');

    // Enter code
    await user.type(codeEditor, 'console.log("Hello, World!");');

    // Click execute
    await user.click(executeButton);

    // Check that service was called
    expect(mockExecuteCode).toHaveBeenCalledWith({
      code: 'console.log("Hello, World!");',
      language: SupportedLanguage.JAVASCRIPT,
      input: undefined,
      timeout: 30000,
    });

    // Wait for results to appear
    await waitFor(() => {
      expect(screen.getByText('Execution Successful')).toBeInTheDocument();
    });

    expect(screen.getByText('Hello, World!')).toBeInTheDocument();
    expect(screen.getByText('Exit Code: 0')).toBeInTheDocument();
    expect(screen.getByText('Time: 150ms')).toBeInTheDocument();
  });

  it('should validate compliance when specifications are provided', async () => {
    const mockValidateCompliance = vi.mocked(codeExecutionService.validateCompliance);
    mockValidateCompliance.mockResolvedValue(mockComplianceResult);

    render(
      <CodeExecutionInterface 
        specifications={mockSpecifications}
        initialCode="function greet() { return 'Hello!'; }"
      />
    );

    const validateButton = screen.getByText('Validate Compliance');

    // Click validate
    await user.click(validateButton);

    // Check that service was called
    expect(mockValidateCompliance).toHaveBeenCalledWith(
      "function greet() { return 'Hello!'; }",
      SupportedLanguage.JAVASCRIPT,
      mockSpecifications
    );

    // Switch to compliance tab to see results
    const complianceTab = screen.getByText('Compliance Report');
    await user.click(complianceTab);

    // Wait for results to appear
    await waitFor(() => {
      expect(screen.getByText('Score: 85%')).toBeInTheDocument();
    });

    expect(screen.getAllByText('PASSED')[0]).toBeInTheDocument();
    expect(screen.getByText('Function should return greeting')).toBeInTheDocument();
  });

  it('should handle execution errors gracefully', async () => {
    const mockExecuteCode = vi.mocked(codeExecutionService.executeCode);
    mockExecuteCode.mockRejectedValue(new Error('Execution failed'));

    render(<CodeExecutionInterface />);

    const codeEditor = screen.getByPlaceholderText(/Enter your javascript code here/);
    const executeButton = screen.getByText('Execute Code');

    // Enter code
    await user.type(codeEditor, 'invalid code');

    // Click execute
    await user.click(executeButton);

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByText('Execution Error:')).toBeInTheDocument();
    });

    expect(screen.getByText('Execution failed')).toBeInTheDocument();
  });

  it('should handle compliance validation errors gracefully', async () => {
    const mockValidateCompliance = vi.mocked(codeExecutionService.validateCompliance);
    mockValidateCompliance.mockRejectedValue(new Error('Validation failed'));

    render(
      <CodeExecutionInterface 
        specifications={mockSpecifications}
        initialCode="some code"
      />
    );

    const validateButton = screen.getByText('Validate Compliance');

    // Click validate
    await user.click(validateButton);

    // Switch to compliance tab
    const complianceTab = screen.getByText('Compliance Report');
    await user.click(complianceTab);

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByText('Validation Error:')).toBeInTheDocument();
    });

    expect(screen.getByText('Validation failed')).toBeInTheDocument();
  });

  it('should disable buttons when code is empty', () => {
    render(<CodeExecutionInterface />);

    const executeButton = screen.getByRole('button', { name: /Execute Code/ });
    expect(executeButton).toBeDisabled();
  });

  it('should not show compliance tab when no specifications provided', () => {
    render(<CodeExecutionInterface />);

    expect(screen.queryByText('Compliance Report')).not.toBeInTheDocument();
    expect(screen.queryByText('Validate Compliance')).not.toBeInTheDocument();
  });

  it('should show compliance tab when specifications are provided', () => {
    render(<CodeExecutionInterface specifications={mockSpecifications} />);

    expect(screen.getByText('Compliance Report')).toBeInTheDocument();
    expect(screen.getByText('Validate Compliance')).toBeInTheDocument();
  });

  it('should handle input and timeout settings', async () => {
    const mockExecuteCode = vi.mocked(codeExecutionService.executeCode);
    mockExecuteCode.mockResolvedValue(mockExecutionResult);

    render(<CodeExecutionInterface initialCode="console.log('test');" />);

    const inputTextarea = screen.getByPlaceholderText('Enter input for your program...');
    const timeoutInput = screen.getByRole('spinbutton', { name: /Timeout/ });
    const executeButton = screen.getByText('Execute Code');

    // Set input and timeout
    await user.type(inputTextarea, 'test input');
    await user.clear(timeoutInput);
    await user.type(timeoutInput, '60');

    // Execute
    await user.click(executeButton);

    expect(mockExecuteCode).toHaveBeenCalledWith({
      code: "console.log('test');",
      language: SupportedLanguage.JAVASCRIPT,
      input: 'test input',
      timeout: 60000,
    });
  });

  it('should support keyboard shortcut for execution', async () => {
    const mockExecuteCode = vi.mocked(codeExecutionService.executeCode);
    mockExecuteCode.mockResolvedValue(mockExecutionResult);

    render(<CodeExecutionInterface initialCode="console.log('test');" />);

    const container = screen.getByText('Code Execution & Validation').closest('div');

    // Simulate Ctrl+Enter
    fireEvent.keyDown(container!, {
      key: 'Enter',
      ctrlKey: true,
    });

    expect(mockExecuteCode).toHaveBeenCalled();
  });

  it('should show loading states during execution and validation', async () => {
    const mockExecuteCode = vi.mocked(codeExecutionService.executeCode);
    const mockValidateCompliance = vi.mocked(codeExecutionService.validateCompliance);
    
    // Make the promises never resolve to test loading state
    mockExecuteCode.mockImplementation(() => new Promise(() => {}));
    mockValidateCompliance.mockImplementation(() => new Promise(() => {}));

    render(
      <CodeExecutionInterface 
        specifications={mockSpecifications}
        initialCode="test code"
      />
    );

    const executeButton = screen.getByText('Execute Code');
    const validateButton = screen.getByText('Validate Compliance');

    // Start execution
    await user.click(executeButton);
    expect(screen.getByText('Executing...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Execute Code/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Validate Compliance/ })).toBeDisabled();
  });

  it('should load example code when Load Example is clicked', async () => {
    render(<CodeExecutionInterface />);

    const loadExampleButton = screen.getByText('Load Example');
    await user.click(loadExampleButton);

    const codeEditor = screen.getByDisplayValue((content, element) => {
      return element?.tagName.toLowerCase() === 'textarea' && 
             content.includes('function greet(name)');
    });

    expect(codeEditor).toBeInTheDocument();
  });

  it('should clear code when Clear button is clicked', async () => {
    render(<CodeExecutionInterface initialCode="some initial code" />);

    const clearButton = screen.getByText('Clear');
    await user.click(clearButton);

    const codeEditor = screen.getByPlaceholderText(/Enter your javascript code here/);
    expect(codeEditor).toHaveValue('');
  });
});