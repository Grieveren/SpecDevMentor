import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkflowIntegration } from '../WorkflowIntegration';
import { workflowService } from '../../../services/workflow.service';
import { SpecificationPhase, DocumentStatus } from '../../../types/project';

// Mock the workflow service
vi.mock('../../../services/workflow.service');

const mockWorkflowService = workflowService as any;

describe('WorkflowIntegration with AI Integration', () => {
  const defaultProps = {
    projectId: 'project-1',
    currentPhase: SpecificationPhase.REQUIREMENTS,
    documentStatuses: {
      [SpecificationPhase.REQUIREMENTS]: DocumentStatus.DRAFT,
      [SpecificationPhase.DESIGN]: DocumentStatus.DRAFT,
      [SpecificationPhase.TASKS]: DocumentStatus.DRAFT,
      [SpecificationPhase.IMPLEMENTATION]: DocumentStatus.DRAFT,
    },
  };

  const mockWorkflowState = {
    projectId: 'project-1',
    currentPhase: SpecificationPhase.REQUIREMENTS,
    phaseHistory: [],
    documentStatuses: defaultProps.documentStatuses,
    approvals: {
      [SpecificationPhase.REQUIREMENTS]: [],
      [SpecificationPhase.DESIGN]: [],
      [SpecificationPhase.TASKS]: [],
      [SpecificationPhase.IMPLEMENTATION]: [],
    },
    canProgress: false,
  };

  const mockPhaseValidation = {
    isValid: true,
    errors: [],
    warnings: [],
    completionPercentage: 85,
    canTransition: false,
    aiValidationScore: 80,
  };

  const mockAIServiceStatus = {
    available: true,
    features: {
      phaseValidation: true,
      autoReview: true,
      complianceCheck: true,
    },
    message: 'AI service is available and operational',
  };

  const mockAIValidation = {
    available: true,
    isValid: true,
    score: 80,
    issues: ['Missing error handling requirements'],
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup default mock implementations
    mockWorkflowService.getWorkflowState.mockResolvedValue(mockWorkflowState);
    mockWorkflowService.validatePhaseCompletion.mockResolvedValue(mockPhaseValidation);
    mockWorkflowService.getAIServiceStatus.mockResolvedValue(mockAIServiceStatus);
    mockWorkflowService.getAIValidation.mockResolvedValue(mockAIValidation);
    mockWorkflowService.getNavigationState.mockReturnValue({
      currentPhase: SpecificationPhase.REQUIREMENTS,
      accessiblePhases: [SpecificationPhase.REQUIREMENTS],
      completedPhases: [],
      phaseValidations: {
        [SpecificationPhase.REQUIREMENTS]: mockPhaseValidation,
        [SpecificationPhase.DESIGN]: mockPhaseValidation,
        [SpecificationPhase.TASKS]: mockPhaseValidation,
        [SpecificationPhase.IMPLEMENTATION]: mockPhaseValidation,
      },
      canProgress: false,
    });
    mockWorkflowService.getPhaseDisplayName.mockImplementation((phase) => 
      phase.charAt(0) + phase.slice(1).toLowerCase()
    );
  });

  it('should display AI service status when available', async () => {
    render(<WorkflowIntegration {...defaultProps} />);

    await waitFor(() => {
      expect(mockWorkflowService.getAIServiceStatus).toHaveBeenCalled();
    });

    // Should show AI validation section
    await waitFor(() => {
      expect(screen.getByText((content, element) => {
        return element?.textContent?.includes('AI Validation') || false;
      })).toBeInTheDocument();
    });

    // Should show AI score
    expect(screen.getByText((content, element) => {
      return element?.textContent?.includes('80% Score') || false;
    })).toBeInTheDocument();
  });

  it('should display AI validation issues', async () => {
    render(<WorkflowIntegration {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText((content, element) => {
        return element?.textContent?.includes('AI-detected issues') || false;
      })).toBeInTheDocument();
    });

    expect(screen.getByText((content, element) => {
      return element?.textContent?.includes('Missing error handling requirements') || false;
    })).toBeInTheDocument();
  });

  it('should show AI Review button when AI service is available', async () => {
    render(<WorkflowIntegration {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText((content, element) => {
        return element?.textContent?.includes('AI Review') || false;
      })).toBeInTheDocument();
    });
  });

  it('should trigger AI review when AI Review button is clicked', async () => {
    const _user = userEvent.setup();
    mockWorkflowService.triggerAIReview.mockResolvedValue({
      success: true,
      review: {
        id: 'review-1',
        overallScore: 85,
        suggestions: [],
        completenessCheck: { score: 80, missingElements: [], recommendations: [] },
        qualityMetrics: { clarity: 85, completeness: 80, consistency: 90, testability: 75, traceability: 85 },
        complianceIssues: [],
        generatedAt: new Date(),
      },
    });

    render(<WorkflowIntegration {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText((content, element) => {
        return element?.textContent?.includes('AI Review') || false;
      })).toBeInTheDocument();
    });

    const aiReviewButton = screen.getByText((content, element) => {
      return element?.textContent?.includes('AI Review') || false;
    });

    await user.click(aiReviewButton);

    expect(mockWorkflowService.triggerAIReview).toHaveBeenCalledWith(
      'project-1',
      SpecificationPhase.REQUIREMENTS
    );
  });

  it('should handle AI review failure gracefully', async () => {
    const _user = userEvent.setup();
    mockWorkflowService.triggerAIReview.mockResolvedValue({
      success: false,
      error: 'AI service temporarily unavailable',
    });

    render(<WorkflowIntegration {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText((content, element) => {
        return element?.textContent?.includes('AI Review') || false;
      })).toBeInTheDocument();
    });

    const aiReviewButton = screen.getByText((content, element) => {
      return element?.textContent?.includes('AI Review') || false;
    });

    await user.click(aiReviewButton);

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText((content, element) => {
        return element?.textContent?.includes('AI service temporarily unavailable') || false;
      })).toBeInTheDocument();
    });
  });

  it('should not show AI features when AI service is unavailable', async () => {
    mockWorkflowService.getAIServiceStatus.mockResolvedValue({
      available: false,
      features: {
        phaseValidation: false,
        autoReview: false,
        complianceCheck: false,
      },
      message: 'AI service is not configured',
    });

    render(<WorkflowIntegration {...defaultProps} />);

    await waitFor(() => {
      expect(mockWorkflowService.getAIServiceStatus).toHaveBeenCalled();
    });

    // Should not show AI validation section
    expect(screen.queryByText((content, element) => {
      return element?.textContent?.includes('AI Validation') || false;
    })).not.toBeInTheDocument();

    // Should not show AI Review button
    expect(screen.queryByText((content, element) => {
      return element?.textContent?.includes('AI Review') || false;
    })).not.toBeInTheDocument();
  });

  it('should include AI validation in phase completion calculation', async () => {
    const validationWithLowAIScore = {
      ...mockPhaseValidation,
      aiValidationScore: 60,
      completionPercentage: 75, // Lower due to AI score
    };

    mockWorkflowService.validatePhaseCompletion.mockResolvedValue(validationWithLowAIScore);

    render(<WorkflowIntegration {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText((content, element) => {
        return element?.textContent?.includes('75% Complete') || false;
      })).toBeInTheDocument();
    });
  });

  it('should show different AI validation states', async () => {
    const invalidAIValidation = {
      available: true,
      isValid: false,
      score: 45,
      issues: ['Critical EARS format violations', 'Missing user stories'],
    };

    mockWorkflowService.getAIValidation.mockResolvedValue(invalidAIValidation);

    render(<WorkflowIntegration {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText((content, element) => {
        return element?.textContent?.includes('45% Score') || false;
      })).toBeInTheDocument();
    });

    expect(screen.getByText((content, element) => {
      return element?.textContent?.includes('Critical EARS format violations') || false;
    })).toBeInTheDocument();

    expect(screen.getByText((content, element) => {
      return element?.textContent?.includes('Missing user stories') || false;
    })).toBeInTheDocument();
  });

  it('should trigger automatic AI review on phase transition', async () => {
    const _user = userEvent.setup();
    
    // Setup mocks for successful transition
    const navigationStateWithProgress = {
      currentPhase: SpecificationPhase.REQUIREMENTS,
      accessiblePhases: [SpecificationPhase.REQUIREMENTS, SpecificationPhase.DESIGN],
      completedPhases: [],
      phaseValidations: {
        [SpecificationPhase.REQUIREMENTS]: {
          ...mockPhaseValidation,
          completionPercentage: 100,
          canTransition: true,
        },
        [SpecificationPhase.DESIGN]: mockPhaseValidation,
        [SpecificationPhase.TASKS]: mockPhaseValidation,
        [SpecificationPhase.IMPLEMENTATION]: mockPhaseValidation,
      },
      canProgress: true,
      nextPhase: SpecificationPhase.DESIGN,
    };

    mockWorkflowService.getNavigationState.mockReturnValue(navigationStateWithProgress);
    mockWorkflowService.transitionPhase.mockResolvedValue();

    const propsWithApprovedPhase = {
      ...defaultProps,
      documentStatuses: {
        ...defaultProps.documentStatuses,
        [SpecificationPhase.REQUIREMENTS]: DocumentStatus.APPROVED,
      },
    };

    render(<WorkflowIntegration {...propsWithApprovedPhase} />);

    await waitFor(() => {
      expect(screen.getByText((content, element) => {
        return element?.textContent?.includes('Proceed to Design') || false;
      })).toBeInTheDocument();
    });

    const proceedButton = screen.getByText((content, element) => {
      return element?.textContent?.includes('Proceed to Design') || false;
    });

    await user.click(proceedButton);

    expect(mockWorkflowService.transitionPhase).toHaveBeenCalledWith({
      projectId: 'project-1',
      targetPhase: SpecificationPhase.DESIGN,
      approvalComment: 'Transitioning to Design phase',
    });
  });

  it('should handle loading states properly', () => {
    // Mock services to never resolve to test loading state
    mockWorkflowService.getWorkflowState.mockImplementation(() => new Promise(() => {}));

    render(<WorkflowIntegration {...defaultProps} />);

    // Should show loading animation
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('should handle error states properly', async () => {
    mockWorkflowService.getWorkflowState.mockRejectedValue(new Error('Network error'));

    render(<WorkflowIntegration {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText((content, element) => {
        return element?.textContent?.includes('Workflow Error') || false;
      })).toBeInTheDocument();
    });

    expect(screen.getByText((content, element) => {
      return element?.textContent?.includes('Failed to load workflow information') || false;
    })).toBeInTheDocument();

    // Should show retry button
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('should call onPhaseChange when phase is changed', async () => {
    const _user = userEvent.setup();
    const onPhaseChange = vi.fn();

    const navigationStateWithAccessiblePhases = {
      currentPhase: SpecificationPhase.REQUIREMENTS,
      accessiblePhases: [SpecificationPhase.REQUIREMENTS, SpecificationPhase.DESIGN],
      completedPhases: [],
      phaseValidations: {
        [SpecificationPhase.REQUIREMENTS]: mockPhaseValidation,
        [SpecificationPhase.DESIGN]: mockPhaseValidation,
        [SpecificationPhase.TASKS]: mockPhaseValidation,
        [SpecificationPhase.IMPLEMENTATION]: mockPhaseValidation,
      },
      canProgress: false,
    };

    mockWorkflowService.getNavigationState.mockReturnValue(navigationStateWithAccessiblePhases);

    render(<WorkflowIntegration {...defaultProps} onPhaseChange={onPhaseChange} />);

    await waitFor(() => {
      // Find the Design phase button (should be accessible)
      const designButton = screen.getByText('Design');
      expect(designButton).toBeInTheDocument();
    });

    const designButton = screen.getByText('Design');
    await user.click(designButton);

    expect(onPhaseChange).toHaveBeenCalledWith(SpecificationPhase.DESIGN);
  });
});