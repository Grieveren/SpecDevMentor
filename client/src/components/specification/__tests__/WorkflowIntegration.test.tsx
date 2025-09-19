import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { WorkflowIntegration } from '../WorkflowIntegration';
import { SpecificationLayout } from '../SpecificationLayout';
import { BreadcrumbNavigation } from '../BreadcrumbNavigation';
import { SpecificationPhase, DocumentStatus } from '../../../types/project';
import { workflowService } from '../../../services/workflow.service';

// Mock the workflow service
vi.mock('../../../services/workflow.service', () => ({
  workflowService: {
    validatePhaseCompletion: vi.fn(),
    requestApproval: vi.fn(),
    transitionPhase: vi.fn(),
    getWorkflowState: vi.fn(),
    getNavigationState: vi.fn(),
    getPhaseDisplayName: vi.fn((phase) => phase.charAt(0) + phase.slice(1).toLowerCase()),
    getPhaseDescription: vi.fn((phase) => `Description for ${phase}`),
    isPhaseAccessible: vi.fn(),
  },
}));

// Mock data
const mockProject = {
  id: 'project-1',
  name: 'Test Project',
  description: 'A test project for workflow integration',
  currentPhase: SpecificationPhase.REQUIREMENTS,
  phases: {
    requirements: { status: DocumentStatus.DRAFT, completionPercentage: 75 },
    design: { status: DocumentStatus.DRAFT, completionPercentage: 0 },
    tasks: { status: DocumentStatus.DRAFT, completionPercentage: 0 },
    implementation: { status: DocumentStatus.DRAFT, completionPercentage: 0 },
  },
};

const mockDocumentStatuses = {
  [SpecificationPhase.REQUIREMENTS]: DocumentStatus.DRAFT,
  [SpecificationPhase.DESIGN]: DocumentStatus.DRAFT,
  [SpecificationPhase.TASKS]: DocumentStatus.DRAFT,
  [SpecificationPhase.IMPLEMENTATION]: DocumentStatus.DRAFT,
};

const mockWorkflowState = {
  projectId: 'project-1',
  currentPhase: SpecificationPhase.REQUIREMENTS,
  canProgress: false,
  nextPhase: SpecificationPhase.DESIGN,
  phaseHistory: [
    {
      fromPhase: SpecificationPhase.REQUIREMENTS,
      toPhase: SpecificationPhase.DESIGN,
      timestamp: new Date('2023-01-01T10:00:00Z'),
      userId: 'user1',
      userName: 'John Doe',
    },
  ],
  documentStatuses: mockDocumentStatuses,
  approvals: {
    [SpecificationPhase.REQUIREMENTS]: [
      {
        userId: 'user1',
        userName: 'John Doe',
        timestamp: new Date('2023-01-01T09:00:00Z'),
        approved: false,
      },
    ],
    [SpecificationPhase.DESIGN]: [],
    [SpecificationPhase.TASKS]: [],
    [SpecificationPhase.IMPLEMENTATION]: [],
  },
};

const mockValidationResult = {
  isValid: false,
  errors: ['Missing user story format in requirement 2'],
  warnings: [],
  completionPercentage: 75,
  canTransition: false,
};

const mockNavigationState = {
  currentPhase: SpecificationPhase.REQUIREMENTS,
  accessiblePhases: [SpecificationPhase.REQUIREMENTS],
  completedPhases: [],
  phaseValidations: {
    [SpecificationPhase.REQUIREMENTS]: mockValidationResult,
    [SpecificationPhase.DESIGN]: { ...mockValidationResult, completionPercentage: 0 },
    [SpecificationPhase.TASKS]: { ...mockValidationResult, completionPercentage: 0 },
    [SpecificationPhase.IMPLEMENTATION]: { ...mockValidationResult, completionPercentage: 0 },
  },
  canProgress: false,
  nextPhase: SpecificationPhase.DESIGN,
};

// MSW server for API mocking
const server = setupServer(
  rest.get('/api/projects/:projectId/workflow/state', (req, res, ctx) => {
    return res(ctx.json(mockWorkflowState));
  }),
  rest.get('/api/projects/:projectId/workflow/validate/:phase', (req, res, ctx) => {
    return res(ctx.json(mockValidationResult));
  }),
  rest.post('/api/projects/:projectId/workflow/approve', (req, res, ctx) => {
    return res(ctx.json({ success: true, message: 'Approval recorded successfully' }));
  }),
  rest.post('/api/projects/:projectId/workflow/transition', (req, res, ctx) => {
    return res(ctx.json({ 
      success: true, 
      message: 'Successfully transitioned to DESIGN',
      workflowState: {
        ...mockWorkflowState,
        currentPhase: SpecificationPhase.DESIGN,
      },
    }));
  })
);

beforeEach(() => {
  server.listen();
  vi.clearAllMocks();
  
  // Setup default mock implementations
  (workflowService.getWorkflowState as any).mockResolvedValue(mockWorkflowState);
  (workflowService.validatePhaseCompletion as any).mockResolvedValue(mockValidationResult);
  (workflowService.getNavigationState as any).mockReturnValue(mockNavigationState);
  (workflowService.requestApproval as any).mockResolvedValue(undefined);
  (workflowService.transitionPhase as any).mockResolvedValue(undefined);
});

afterEach(() => {
  server.resetHandlers();
  server.close();
});

describe('Workflow Integration Tests', () => {
  describe('WorkflowIntegration Component', () => {
    it('should render workflow navigation with progress indicators', async () => {
      render(
        <WorkflowIntegration
          projectId="project-1"
          currentPhase={SpecificationPhase.REQUIREMENTS}
          documentStatuses={mockDocumentStatuses}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Phase Navigation')).toBeInTheDocument();
      });

      // Should show all phases
      expect(screen.getByText('Requirements')).toBeInTheDocument();
      expect(screen.getByText('Design')).toBeInTheDocument();
      expect(screen.getByText('Tasks')).toBeInTheDocument();
      expect(screen.getByText('Implementation')).toBeInTheDocument();

      // Should show progress indicators
      expect(screen.getByText('75% Complete')).toBeInTheDocument();
    });

    it('should display validation errors for current phase', async () => {
      render(
        <WorkflowIntegration
          projectId="project-1"
          currentPhase={SpecificationPhase.REQUIREMENTS}
          documentStatuses={mockDocumentStatuses}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Issues to resolve:')).toBeInTheDocument();
      });

      expect(screen.getByText('• Missing user story format in requirement 2')).toBeInTheDocument();
    });

    it('should handle phase change when accessible phase is clicked', async () => {
      const _user = userEvent.setup();
      const mockOnPhaseChange = vi.fn();

      render(
        <WorkflowIntegration
          projectId="project-1"
          currentPhase={SpecificationPhase.REQUIREMENTS}
          documentStatuses={mockDocumentStatuses}
          onPhaseChange={mockOnPhaseChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Phase Navigation')).toBeInTheDocument();
      });

      // Click on accessible phase (Requirements)
      const requirementsButton = screen.getByRole('button', { name: '1' });
      await user.click(requirementsButton);

      expect(mockOnPhaseChange).toHaveBeenCalledWith(SpecificationPhase.REQUIREMENTS);
    });

    it('should show request approval button when phase is complete', async () => {
      const completeValidationResult = {
        ...mockValidationResult,
        isValid: true,
        errors: [],
        completionPercentage: 100,
      };

      (workflowService.validatePhaseCompletion as any).mockResolvedValue(completeValidationResult);

      render(
        <WorkflowIntegration
          projectId="project-1"
          currentPhase={SpecificationPhase.REQUIREMENTS}
          documentStatuses={mockDocumentStatuses}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Request Approval')).toBeInTheDocument();
      });
    });

    it('should handle approval request', async () => {
      const _user = userEvent.setup();
      const mockOnRequestApproval = vi.fn();

      const completeValidationResult = {
        ...mockValidationResult,
        isValid: true,
        errors: [],
        completionPercentage: 100,
      };

      (workflowService.validatePhaseCompletion as any).mockResolvedValue(completeValidationResult);

      render(
        <WorkflowIntegration
          projectId="project-1"
          currentPhase={SpecificationPhase.REQUIREMENTS}
          documentStatuses={mockDocumentStatuses}
          onRequestApproval={mockOnRequestApproval}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Request Approval')).toBeInTheDocument();
      });

      const approvalButton = screen.getByText('Request Approval');
      await user.click(approvalButton);

      expect(workflowService.requestApproval).toHaveBeenCalledWith({
        projectId: 'project-1',
        phase: SpecificationPhase.REQUIREMENTS,
        comment: 'Requesting approval for Requirements phase',
      });

      expect(mockOnRequestApproval).toHaveBeenCalledWith(SpecificationPhase.REQUIREMENTS);
    });

    it('should show proceed button when phase is approved and can progress', async () => {
      const _user = userEvent.setup();
      const mockOnTransitionPhase = vi.fn();

      const approvedWorkflowState = {
        ...mockWorkflowState,
        canProgress: true,
        documentStatuses: {
          ...mockDocumentStatuses,
          [SpecificationPhase.REQUIREMENTS]: DocumentStatus.APPROVED,
        },
      };

      const approvedNavigationState = {
        ...mockNavigationState,
        canProgress: true,
        completedPhases: [SpecificationPhase.REQUIREMENTS],
      };

      (workflowService.getWorkflowState as any).mockResolvedValue(approvedWorkflowState);
      (workflowService.getNavigationState as any).mockReturnValue(approvedNavigationState);

      render(
        <WorkflowIntegration
          projectId="project-1"
          currentPhase={SpecificationPhase.REQUIREMENTS}
          documentStatuses={approvedWorkflowState.documentStatuses}
          onTransitionPhase={mockOnTransitionPhase}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Proceed to Design')).toBeInTheDocument();
      });

      const proceedButton = screen.getByText('Proceed to Design');
      await user.click(proceedButton);

      expect(workflowService.transitionPhase).toHaveBeenCalledWith({
        projectId: 'project-1',
        targetPhase: SpecificationPhase.DESIGN,
        approvalComment: 'Transitioning to Design phase',
      });

      expect(mockOnTransitionPhase).toHaveBeenCalledWith(SpecificationPhase.DESIGN);
    });

    it('should handle loading state', () => {
      (workflowService.getWorkflowState as any).mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 1000))
      );

      render(
        <WorkflowIntegration
          projectId="project-1"
          currentPhase={SpecificationPhase.REQUIREMENTS}
          documentStatuses={mockDocumentStatuses}
        />
      );

      expect(screen.getByRole('generic', { name: /loading/i }) || 
             document.querySelector('.animate-pulse')).toBeInTheDocument();
    });

    it('should handle error state', async () => {
      (workflowService.getWorkflowState as any).mockRejectedValue(new Error('Failed to load workflow'));

      render(
        <WorkflowIntegration
          projectId="project-1"
          currentPhase={SpecificationPhase.REQUIREMENTS}
          documentStatuses={mockDocumentStatuses}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Workflow Error')).toBeInTheDocument();
      });

      expect(screen.getByText('Failed to load workflow information')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  describe('SpecificationLayout Integration', () => {
    it('should render layout with breadcrumb navigation', () => {
      render(
        <SpecificationLayout
          currentPhase={SpecificationPhase.REQUIREMENTS}
          project={mockProject}
        >
          <div>Test Content</div>
        </SpecificationLayout>
      );

      // Should show project name
      expect(screen.getByText('Test Project')).toBeInTheDocument();
      
      // Should show breadcrumb navigation
      expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument();
      
      // Should show current phase
      expect(screen.getByText('Requirements')).toBeInTheDocument();
    });

    it('should handle sidebar collapse and expand', async () => {
      const _user = userEvent.setup();

      render(
        <SpecificationLayout
          currentPhase={SpecificationPhase.REQUIREMENTS}
          project={mockProject}
        >
          <div>Test Content</div>
        </SpecificationLayout>
      );

      // Should show project name initially
      expect(screen.getByText('Test Project')).toBeInTheDocument();

      // Find and click collapse button
      const collapseButton = screen.getByRole('button', { name: /close|collapse/i });
      await user.click(collapseButton);

      // Project name should be hidden when collapsed
      expect(screen.queryByText('Test Project')).not.toBeInTheDocument();
    });

    it('should integrate workflow navigation in sidebar', async () => {
      render(
        <SpecificationLayout
          currentPhase={SpecificationPhase.REQUIREMENTS}
          project={mockProject}
        >
          <div>Test Content</div>
        </SpecificationLayout>
      );

      // Should show workflow navigation components
      await waitFor(() => {
        expect(screen.getByText('Workflow Navigation')).toBeInTheDocument();
      });
    });
  });

  describe('BreadcrumbNavigation', () => {
    it('should render breadcrumb with project and phase navigation', () => {
      const mockOnNavigateToProject = vi.fn();
      const mockOnNavigateToPhase = vi.fn();

      render(
        <BreadcrumbNavigation
          projectName="Test Project"
          currentPhase={SpecificationPhase.REQUIREMENTS}
          onNavigateToProject={mockOnNavigateToProject}
          onNavigateToPhase={mockOnNavigateToPhase}
        />
      );

      expect(screen.getByText('Projects')).toBeInTheDocument();
      expect(screen.getByText('Test Project')).toBeInTheDocument();
      expect(screen.getByText('Requirements')).toBeInTheDocument();
    });

    it('should handle navigation clicks', async () => {
      const _user = userEvent.setup();
      const mockOnNavigateToProject = vi.fn();
      const mockOnNavigateToPhase = vi.fn();

      render(
        <BreadcrumbNavigation
          projectName="Test Project"
          currentPhase={SpecificationPhase.REQUIREMENTS}
          onNavigateToProject={mockOnNavigateToProject}
          onNavigateToPhase={mockOnNavigateToPhase}
        />
      );

      // Click on Projects
      const projectsButton = screen.getByText('Projects');
      await user.click(projectsButton);
      expect(mockOnNavigateToProject).toHaveBeenCalled();

      // Click on Project name
      const projectButton = screen.getByText('Test Project');
      await user.click(projectButton);
      expect(mockOnNavigateToProject).toHaveBeenCalled();
    });
  });

  describe('Complete Workflow Progression', () => {
    it('should handle end-to-end workflow from requirements to implementation', async () => {
      const _user = userEvent.setup();
      
      // Start with requirements phase
      let currentPhase = SpecificationPhase.REQUIREMENTS;
      const documentStatuses = { ...mockDocumentStatuses };
      
      const mockOnPhaseChange = vi.fn().mockImplementation((phase) => {
        currentPhase = phase;
      });
      
      const mockOnTransitionPhase = vi.fn().mockImplementation((phase) => {
        currentPhase = phase;
        documentStatuses[phase] = DocumentStatus.DRAFT;
      });

      const mockOnRequestApproval = vi.fn().mockImplementation((phase) => {
        documentStatuses[phase] = DocumentStatus.REVIEW;
        // Simulate approval after a delay
        setTimeout(() => {
          documentStatuses[phase] = DocumentStatus.APPROVED;
        }, 100);
      });

      const { rerender } = render(
        <WorkflowIntegration
          projectId="project-1"
          currentPhase={currentPhase}
          documentStatuses={documentStatuses}
          onPhaseChange={mockOnPhaseChange}
          onRequestApproval={mockOnRequestApproval}
          onTransitionPhase={mockOnTransitionPhase}
        />
      );

      // Should start with Requirements phase
      await waitFor(() => {
        expect(screen.getByText('Current Phase: Requirements')).toBeInTheDocument();
      });

      // Mock complete requirements phase
      const completeValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
        completionPercentage: 100,
        canTransition: true,
      };

      (workflowService.validatePhaseCompletion as any).mockResolvedValue(completeValidationResult);

      // Re-render with updated validation
      rerender(
        <WorkflowIntegration
          projectId="project-1"
          currentPhase={currentPhase}
          documentStatuses={documentStatuses}
          onPhaseChange={mockOnPhaseChange}
          onRequestApproval={mockOnRequestApproval}
          onTransitionPhase={mockOnTransitionPhase}
        />
      );

      // Should show request approval button
      await waitFor(() => {
        expect(screen.getByText('Request Approval')).toBeInTheDocument();
      });

      // Request approval
      const approvalButton = screen.getByText('Request Approval');
      await user.click(approvalButton);

      expect(mockOnRequestApproval).toHaveBeenCalledWith(SpecificationPhase.REQUIREMENTS);

      // Simulate approval completion
      documentStatuses[SpecificationPhase.REQUIREMENTS] = DocumentStatus.APPROVED;
      
      const approvedNavigationState = {
        ...mockNavigationState,
        canProgress: true,
        completedPhases: [SpecificationPhase.REQUIREMENTS],
      };

      (workflowService.getNavigationState as any).mockReturnValue(approvedNavigationState);

      // Re-render with approved status
      rerender(
        <WorkflowIntegration
          projectId="project-1"
          currentPhase={currentPhase}
          documentStatuses={documentStatuses}
          onPhaseChange={mockOnPhaseChange}
          onRequestApproval={mockOnRequestApproval}
          onTransitionPhase={mockOnTransitionPhase}
        />
      );

      // Should show proceed button
      await waitFor(() => {
        expect(screen.getByText((content, element) => {
          return element?.textContent?.includes('Proceed to Design') || false;
        })).toBeInTheDocument();
      });

      // Proceed to next phase
      const proceedButton = screen.getByText('Proceed to Design');
      await user.click(proceedButton);

      expect(mockOnTransitionPhase).toHaveBeenCalledWith(SpecificationPhase.DESIGN);
    });

    it('should prevent unauthorized phase transitions', async () => {
      const _user = userEvent.setup();

      // Mock validation that prevents transition
      const invalidValidationResult = {
        isValid: false,
        errors: ['Phase validation failed'],
        warnings: [],
        completionPercentage: 50,
        canTransition: false,
      };

      (workflowService.validatePhaseCompletion as any).mockResolvedValue(invalidValidationResult);

      render(
        <WorkflowIntegration
          projectId="project-1"
          currentPhase={SpecificationPhase.REQUIREMENTS}
          documentStatuses={mockDocumentStatuses}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Issues to resolve:')).toBeInTheDocument();
      });

      // Should not show proceed button when validation fails
      expect(screen.queryByText((content, element) => {
        return element?.textContent?.includes('Proceed to Design') || false;
      })).not.toBeInTheDocument();
    });

    it('should handle workflow validation errors gracefully', async () => {
      (workflowService.validatePhaseCompletion as any).mockRejectedValue(
        new Error('Validation service unavailable')
      );

      render(
        <WorkflowIntegration
          projectId="project-1"
          currentPhase={SpecificationPhase.REQUIREMENTS}
          documentStatuses={mockDocumentStatuses}
        />
      );

      await waitFor(() => {
        expect(screen.getByText((content, element) => {
          return element?.textContent?.includes('Failed to load workflow information') || false;
        })).toBeInTheDocument();
      });
    });

    it('should display comprehensive phase history and approvals', async () => {
      const workflowStateWithHistory = {
        ...mockWorkflowState,
        currentPhase: SpecificationPhase.TASKS,
        phaseHistory: [
          {
            fromPhase: SpecificationPhase.REQUIREMENTS,
            toPhase: SpecificationPhase.DESIGN,
            timestamp: new Date('2023-01-01T10:00:00Z'),
            userId: 'user1',
            userName: 'John Doe',
          },
          {
            fromPhase: SpecificationPhase.DESIGN,
            toPhase: SpecificationPhase.TASKS,
            timestamp: new Date('2023-01-02T14:30:00Z'),
            userId: 'user2',
            userName: 'Jane Smith',
          },
        ],
        approvals: {
          [SpecificationPhase.REQUIREMENTS]: [
            {
              userId: 'user1',
              userName: 'John Doe',
              timestamp: new Date('2023-01-01T09:00:00Z'),
              approved: true,
            },
          ],
          [SpecificationPhase.DESIGN]: [
            {
              userId: 'user2',
              userName: 'Jane Smith',
              timestamp: new Date('2023-01-02T13:00:00Z'),
              approved: true,
            },
          ],
          [SpecificationPhase.TASKS]: [],
          [SpecificationPhase.IMPLEMENTATION]: [],
        },
      };

      (workflowService.getWorkflowState as any).mockResolvedValue(workflowStateWithHistory);

      render(
        <WorkflowIntegration
          projectId="project-1"
          currentPhase={SpecificationPhase.TASKS}
          documentStatuses={mockDocumentStatuses}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Phase History')).toBeInTheDocument();
      });

      // Should show phase history section
      expect(screen.getByText('Phase History')).toBeInTheDocument();
      
      // Should show approval information sections
      await waitFor(() => {
        expect(screen.getByText((content, element) => {
          return element?.textContent?.includes('Approvals') || false;
        })).toBeInTheDocument();
      });
    });

    it('should handle multiple approval requirements', async () => {
      const multiApprovalWorkflowState = {
        ...mockWorkflowState,
        approvals: {
          [SpecificationPhase.REQUIREMENTS]: [
            {
              userId: 'user1',
              userName: 'John Doe',
              timestamp: new Date('2023-01-01T09:00:00Z'),
              approved: true,
            },
            {
              userId: 'user2',
              userName: 'Jane Smith',
              timestamp: new Date('2023-01-01T10:00:00Z'),
              approved: false,
            },
          ],
          [SpecificationPhase.DESIGN]: [],
          [SpecificationPhase.TASKS]: [],
          [SpecificationPhase.IMPLEMENTATION]: [],
        },
      };

      (workflowService.getWorkflowState as any).mockResolvedValue(multiApprovalWorkflowState);

      render(
        <WorkflowIntegration
          projectId="project-1"
          currentPhase={SpecificationPhase.REQUIREMENTS}
          documentStatuses={mockDocumentStatuses}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('1/2')).toBeInTheDocument(); // Approval count
      });

      // Should show approval status indicators
      await waitFor(() => {
        expect(screen.getByText('1/2')).toBeInTheDocument(); // Approval count
      });
      
      // Should show approval status
      expect(screen.getAllByText('Approved').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Pending').length).toBeGreaterThan(0);
    });
  });

  describe('Accessibility and User Experience', () => {
    it('should have proper ARIA labels and roles', async () => {
      render(
        <WorkflowIntegration
          projectId="project-1"
          currentPhase={SpecificationPhase.REQUIREMENTS}
          documentStatuses={mockDocumentStatuses}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Phase Navigation')).toBeInTheDocument();
      });

      // Check for proper button roles
      const phaseButtons = screen.getAllByRole('button');
      expect(phaseButtons.length).toBeGreaterThan(0);

      // Check for progress indicators
      const progressBars = document.querySelectorAll('.h-2.rounded-full');
      expect(progressBars.length).toBeGreaterThan(0);
    });

    it('should support keyboard navigation', async () => {
      const _user = userEvent.setup();
      const mockOnPhaseChange = vi.fn();

      render(
        <WorkflowIntegration
          projectId="project-1"
          currentPhase={SpecificationPhase.REQUIREMENTS}
          documentStatuses={mockDocumentStatuses}
          onPhaseChange={mockOnPhaseChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Phase Navigation')).toBeInTheDocument();
      });

      // Tab to phase button and press Enter
      const phaseButton = screen.getByRole('button', { name: '1' });
      phaseButton.focus();
      await user.keyboard('{Enter}');

      expect(mockOnPhaseChange).toHaveBeenCalledWith(SpecificationPhase.REQUIREMENTS);
    });

    it('should provide clear visual feedback for different states', async () => {
      const approvedDocumentStatuses = {
        ...mockDocumentStatuses,
        [SpecificationPhase.REQUIREMENTS]: DocumentStatus.APPROVED,
      };

      render(
        <WorkflowIntegration
          projectId="project-1"
          currentPhase={SpecificationPhase.DESIGN}
          documentStatuses={approvedDocumentStatuses}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Phase Navigation')).toBeInTheDocument();
      });

      // Should show visual indicators for completed phases
      const completedPhaseIndicator = document.querySelector('.bg-green-500');
      expect(completedPhaseIndicator).toBeInTheDocument();
    });
  });
});