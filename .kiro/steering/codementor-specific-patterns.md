# CodeMentor-AI Specific Patterns

## Specification Workflow Components

### Phase Management Patterns

```typescript
// Standard phase enum and validation
enum SpecificationPhase {
  REQUIREMENTS = 'requirements',
  DESIGN = 'design',
  TASKS = 'tasks',
  IMPLEMENTATION = 'implementation',
}

// Phase transition validation pattern
interface PhaseValidator {
  canTransition(from: SpecificationPhase, to: SpecificationPhase): boolean;
  validatePhaseCompletion(
    phase: SpecificationPhase,
    document: SpecificationDocument
  ): ValidationResult;
  getRequiredApprovals(phase: SpecificationPhase): ApprovalRequirement[];
}

// Use this pattern for all phase-related components
const usePhaseTransition = (projectId: string) => {
  const [currentPhase, setCurrentPhase] = useState<SpecificationPhase>();
  const [canProgress, setCanProgress] = useState(false);

  const validateAndTransition = async (targetPhase: SpecificationPhase) => {
    const validation = await phaseValidator.validatePhaseCompletion(currentPhase, document);
    if (validation.isValid) {
      setCurrentPhase(targetPhase);
    }
    return validation;
  };

  return { currentPhase, canProgress, validateAndTransition };
};
```

### Document Editor Patterns

```typescript
// Standard document editor interface
interface SpecificationEditorProps {
  document: SpecificationDocument;
  phase: SpecificationPhase;
  mode: 'edit' | 'review' | 'readonly';
  onSave: (content: string) => Promise<void>;
  onRequestReview?: () => Promise<void>;
  collaborationEnabled?: boolean;
}

// Auto-save pattern for all editors
const useAutoSave = (content: string, onSave: (content: string) => Promise<void>) => {
  const [lastSaved, setLastSaved] = useState<Date>();
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (content && !isSaving) {
        setIsSaving(true);
        await onSave(content);
        setLastSaved(new Date());
        setIsSaving(false);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [content]);

  return { lastSaved, isSaving };
};
```

### Template System Patterns

```typescript
// Template application pattern
interface TemplateApplicator {
  applyTemplate(template: Template, targetDocument: SpecificationDocument): Promise<string>;
  extractVariables(template: string): TemplateVariable[];
  substituteVariables(template: string, values: Record<string, string>): string;
}

// Template metadata structure
interface Template {
  id: string;
  name: string;
  description: string;
  phase: SpecificationPhase;
  category: TemplateCategory;
  content: string;
  variables: TemplateVariable[];
  tags: string[];
  usage: {
    timesUsed: number;
    rating: number;
    lastUsed: Date;
  };
}
```

## UI Component Patterns

### Specification Layout Components

```typescript
// Standard layout for all specification pages
const SpecificationLayout: React.FC<SpecificationLayoutProps> = ({
  currentPhase,
  project,
  children,
  showSidebar = true,
  sidebarCollapsed = false,
}) => {
  return (
    <div className="flex h-screen bg-gray-50">
      {showSidebar && (
        <SpecificationSidebar
          phases={project.phases}
          currentPhase={currentPhase}
          collapsed={sidebarCollapsed}
        />
      )}
      <main className="flex-1 overflow-hidden">
        <SpecificationHeader project={project} currentPhase={currentPhase} />
        <div className="h-full overflow-auto p-6">{children}</div>
      </main>
    </div>
  );
};
```

### Progress Indicators

```typescript
// Consistent progress indication across the app
const PhaseProgressIndicator: React.FC<{
  phases: SpecificationPhase[];
  currentPhase: SpecificationPhase;
  completedPhases: SpecificationPhase[];
}> = ({ phases, currentPhase, completedPhases }) => {
  return (
    <div className="flex items-center space-x-4">
      {phases.map((phase, index) => (
        <div key={phase} className="flex items-center">
          <div
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
              completedPhases.includes(phase) && 'bg-green-500 text-white',
              phase === currentPhase && 'bg-blue-500 text-white',
              !completedPhases.includes(phase) &&
                phase !== currentPhase &&
                'bg-gray-200 text-gray-600'
            )}
          >
            {completedPhases.includes(phase) ? '✓' : index + 1}
          </div>
          {index < phases.length - 1 && (
            <div
              className={cn(
                'w-12 h-0.5 mx-2',
                completedPhases.includes(phase) ? 'bg-green-500' : 'bg-gray-200'
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
};
```

## State Management Patterns

### Specification Store Structure

```typescript
// Zustand store for specification workflow
interface SpecificationStore {
  // Current state
  currentProject: SpecificationProject | null;
  currentPhase: SpecificationPhase;
  activeDocument: SpecificationDocument | null;

  // Actions
  setCurrentProject: (project: SpecificationProject) => void;
  updateDocument: (documentId: string, content: string) => Promise<void>;
  transitionPhase: (targetPhase: SpecificationPhase) => Promise<boolean>;
  requestAIReview: (documentId: string) => Promise<AIReviewResult>;

  // Collaboration state
  collaborators: CollaborationUser[];
  documentChanges: DocumentChange[];

  // UI state
  sidebarCollapsed: boolean;
  activePanel: 'editor' | 'review' | 'comments';
}

const useSpecificationStore = create<SpecificationStore>((set, get) => ({
  // Implementation following this pattern
}));
```

## Error Handling Patterns

### Specification-Specific Errors

```typescript
// Custom error types for specification workflow
class SpecificationError extends Error {
  constructor(
    message: string,
    public code: SpecificationErrorCode,
    public phase?: SpecificationPhase,
    public documentId?: string
  ) {
    super(message);
    this.name = 'SpecificationError';
  }
}

enum SpecificationErrorCode {
  PHASE_VALIDATION_FAILED = 'PHASE_VALIDATION_FAILED',
  DOCUMENT_LOCKED = 'DOCUMENT_LOCKED',
  APPROVAL_REQUIRED = 'APPROVAL_REQUIRED',
  TEMPLATE_APPLICATION_FAILED = 'TEMPLATE_APPLICATION_FAILED',
}

// Error boundary for specification components
const SpecificationErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ErrorBoundary
      fallback={({ error, resetError }) => (
        <SpecificationErrorFallback error={error} onRetry={resetError} />
      )}
      onError={error => {
        // Log specification-specific errors
        console.error('Specification Error:', error);
      }}
    >
      {children}
    </ErrorBoundary>
  );
};
```
