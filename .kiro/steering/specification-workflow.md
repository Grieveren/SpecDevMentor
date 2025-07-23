# Specification Workflow Patterns

## Specification System Architecture

This project uses a structured specification workflow with defined phases:

- **Requirements**: Define project scope and user needs
- **Design**: Create technical architecture and UI/UX designs
- **Tasks**: Break down implementation into actionable items
- **Implementation**: Execute development work
- **Review**: Quality assurance and testing
- **Completed**: Final delivery and documentation

## Component Patterns for Specifications

### Layout Components

- Use `SpecificationLayout` as the main wrapper for spec-related pages
- Implement responsive sidebar navigation with collapse functionality
- Include breadcrumb navigation for phase transitions
- Support mobile-first responsive design

### Navigation Patterns

```typescript
interface SpecificationLayoutProps {
  currentPhase: SpecificationPhase;
  onPhaseChange?: (phase: SpecificationPhase) => void;
  project?: SpecificationProject;
  showSidebar?: boolean;
  sidebarCollapsed?: boolean;
}
```

### State Management for Specifications

- Use Zustand for specification workflow state
- Maintain current phase and project context
- Handle phase transitions with proper validation
- Persist workflow state across sessions

## File Organization for Specs

- Store specifications in `.kiro/specs/` directory
- Use markdown files for requirements, design, and tasks
- Include file references with `#[[file:path]]` syntax
- Maintain clear separation between phases

## UI Patterns

- Use Headless UI components for complex interactions
- Implement consistent spacing with Tailwind utilities
- Use Heroicons for consistent iconography
- Apply proper focus management for accessibility

## Documentation Standards

- Write specifications in clear, actionable language
- Include code examples and implementation details
- Reference external files and dependencies
- Maintain version history and change tracking
