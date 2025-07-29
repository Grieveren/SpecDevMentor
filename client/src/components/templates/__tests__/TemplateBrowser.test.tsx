import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TemplateBrowser } from '../TemplateBrowser';
import { templateService } from '../../../services/template.service';

// Mock the template service
vi.mock('../../../services/template.service', () => ({
  templateService: {
    searchTemplates: vi.fn(),
  },
}));

const mockTemplates = [
  {
    id: 'template-1',
    name: 'Requirements Template',
    description: 'A template for writing requirements',
    phase: 'REQUIREMENTS' as const,
    category: 'REQUIREMENTS' as const,
    content: 'Template content',
    variables: [],
    tags: ['requirements', 'template'],
    isPublic: true,
    isOfficial: true,
    usageCount: 10,
    rating: 4.5,
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z',
    author: {
      id: 'user-1',
      name: 'John Doe',
      email: 'john@example.com',
    },
    _count: {
      usages: 5,
    },
  },
  {
    id: 'template-2',
    name: 'Design Template',
    description: 'A template for system design',
    phase: 'DESIGN' as const,
    category: 'DESIGN' as const,
    content: 'Design template content',
    variables: [
      {
        name: 'projectName',
        description: 'Name of the project',
        type: 'text' as const,
        required: true,
      },
    ],
    tags: ['design', 'architecture'],
    isPublic: false,
    isOfficial: false,
    usageCount: 5,
    rating: 3.8,
    createdAt: '2023-01-02T00:00:00Z',
    updatedAt: '2023-01-02T00:00:00Z',
    author: {
      id: 'user-2',
      name: 'Jane Smith',
      email: 'jane@example.com',
    },
    _count: {
      usages: 3,
    },
  },
];

const mockPaginatedResponse = {
  templates: mockTemplates,
  pagination: {
    page: 1,
    limit: 12,
    total: 2,
    pages: 1,
  },
};

describe('TemplateBrowser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (templateService.searchTemplates as any).mockResolvedValue(mockPaginatedResponse);
  });

  it('should render template browser with templates', async () => {
    render(<TemplateBrowser />);

    await waitFor(() => {
      expect(screen.getByText('Requirements Template')).toBeInTheDocument();
      expect(screen.getByText('Design Template')).toBeInTheDocument();
    });

    expect(screen.getByText('A template for writing requirements')).toBeInTheDocument();
    expect(screen.getByText('A template for system design')).toBeInTheDocument();
  });

  it('should display template metadata correctly', async () => {
    render(<TemplateBrowser />);

    await waitFor(() => {
      expect(screen.getByText('Requirements Template')).toBeInTheDocument();
    });

    // Check for official badge
    expect(screen.getByText('Official')).toBeInTheDocument();

    // Check for author names
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();

    // Check for usage counts
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();

    // Check for tags
    expect(screen.getByText('requirements')).toBeInTheDocument();
    expect(screen.getByText('design')).toBeInTheDocument();
  });

  it('should handle search functionality', async () => {
    const _user = userEvent.setup();
    render(<TemplateBrowser />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Requirements Template')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search templates...');
    await user.type(searchInput, 'requirements');

    await waitFor(() => {
      expect(templateService.searchTemplates).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'requirements',
          page: 1,
        })
      );
    });
  });

  it('should handle filter changes', async () => {
    const _user = userEvent.setup();
    render(<TemplateBrowser />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Requirements Template')).toBeInTheDocument();
    });

    // Open filters
    const filtersButton = screen.getByText('Filters');
    await user.click(filtersButton);

    // Change phase filter
    const phaseSelect = screen.getByLabelText('Phase');
    await user.selectOptions(phaseSelect, 'REQUIREMENTS');

    await waitFor(() => {
      expect(templateService.searchTemplates).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: 'REQUIREMENTS',
          page: 1,
        })
      );
    });
  });

  it('should call onSelectTemplate when template is clicked', async () => {
    const _user = userEvent.setup();
    const onSelectTemplate = vi.fn();
    
    render(<TemplateBrowser onSelectTemplate={onSelectTemplate} />);

    await waitFor(() => {
      expect(screen.getByText('Requirements Template')).toBeInTheDocument();
    });

    const templateCard = screen.getByText('Requirements Template').closest('div');
    await user.click(templateCard!);

    expect(onSelectTemplate).toHaveBeenCalledWith(mockTemplates[0]);
  });

  it('should call onApplyTemplate when apply button is clicked', async () => {
    const _user = userEvent.setup();
    const onApplyTemplate = vi.fn();
    
    render(<TemplateBrowser onApplyTemplate={onApplyTemplate} />);

    await waitFor(() => {
      expect(screen.getByText('Requirements Template')).toBeInTheDocument();
    });

    const applyButtons = screen.getAllByText('Apply Template');
    await user.click(applyButtons[0]);

    expect(onApplyTemplate).toHaveBeenCalledWith(mockTemplates[0]);
  });

  it('should filter by selected phase', async () => {
    render(<TemplateBrowser selectedPhase="DESIGN" />);

    await waitFor(() => {
      expect(templateService.searchTemplates).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: 'DESIGN',
        })
      );
    });
  });

  it('should handle loading state', () => {
    (templateService.searchTemplates as any).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<TemplateBrowser />);

    // Check for loading spinner by class name since it doesn't have role="status"
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('should handle error state', async () => {
    const errorMessage = 'Failed to load templates';
    (templateService.searchTemplates as any).mockRejectedValue(new Error(errorMessage));

    render(<TemplateBrowser />);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('should handle empty results', async () => {
    (templateService.searchTemplates as any).mockResolvedValue({
      templates: [],
      pagination: {
        page: 1,
        limit: 12,
        total: 0,
        pages: 0,
      },
    });

    render(<TemplateBrowser />);

    await waitFor(() => {
      expect(screen.getByText('No templates found')).toBeInTheDocument();
    });
  });

  it('should handle pagination', async () => {
    const _user = userEvent.setup();
    const multiPageResponse = {
      ...mockPaginatedResponse,
      pagination: {
        page: 1,
        limit: 12,
        total: 25,
        pages: 3,
      },
    };

    (templateService.searchTemplates as any).mockResolvedValue(multiPageResponse);

    render(<TemplateBrowser />);

    await waitFor(() => {
      expect(screen.getByText('Requirements Template')).toBeInTheDocument();
    });

    // Should show pagination controls
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('should show correct category labels', async () => {
    render(<TemplateBrowser />);

    await waitFor(() => {
      expect(screen.getByText('Requirements Template')).toBeInTheDocument();
    });

    // Check that category values are converted to readable labels
    expect(screen.getByText('Requirements')).toBeInTheDocument();
    expect(screen.getByText('Design')).toBeInTheDocument();
  });

  it('should truncate long tag lists', async () => {
    const templateWithManyTags = {
      ...mockTemplates[0],
      tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'],
    };

    (templateService.searchTemplates as any).mockResolvedValue({
      templates: [templateWithManyTags],
      pagination: mockPaginatedResponse.pagination,
    });

    render(<TemplateBrowser />);

    await waitFor(() => {
      expect(screen.getByText('Requirements Template')).toBeInTheDocument();
    });

    // Should show first 3 tags and "+X more"
    expect(screen.getByText('tag1')).toBeInTheDocument();
    expect(screen.getByText('tag2')).toBeInTheDocument();
    expect(screen.getByText('tag3')).toBeInTheDocument();
    expect(screen.getByText('+2 more')).toBeInTheDocument();
  });
});