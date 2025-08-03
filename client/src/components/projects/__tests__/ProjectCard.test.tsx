// @ts-nocheck
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProjectCard } from '../ProjectCard';
import { Project, SpecificationPhase, ProjectStatus, TeamMemberRole, TeamMemberStatus } from '../../../types/project';

const mockProject: Project = {
  id: '1',
  name: 'Test Project',
  description: 'A test project for unit testing',
  currentPhase: SpecificationPhase.REQUIREMENTS,
  status: ProjectStatus.ACTIVE,
  createdAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-02T00:00:00Z',
  owner: {
    id: 'owner-1',
    name: 'John Doe',
    email: 'john@example.com',
  },
  team: [
    {
      id: 'team-1',
      role: TeamMemberRole.MEMBER,
      status: TeamMemberStatus.ACTIVE,
      joinedAt: '2023-01-01T00:00:00Z',
      user: {
        id: 'user-1',
        name: 'Jane Smith',
        email: 'jane@example.com',
      },
    },
  ],
  documents: [
    {
      id: 'doc-1',
      phase: SpecificationPhase.REQUIREMENTS,
      status: 'DRAFT' as any,
      version: 1,
      updatedAt: '2023-01-02T00:00:00Z',
    },
  ],
  _count: {
    documents: 1,
    team: 1,
  },
};

describe('ProjectCard', () => {
  it('should render project information correctly', () => {
    render(<ProjectCard project={mockProject} />);

    expect(screen.getByText('Test Project')).toBeInTheDocument();
    expect(screen.getByText('A test project for unit testing')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('REQUIREMENTS')).toBeInTheDocument();
    expect(screen.getByText('Created by John Doe')).toBeInTheDocument();
  });

  it('should display team member count correctly', () => {
    render(<ProjectCard project={mockProject} />);

    // Should show 2 (1 team member + 1 owner)
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1 member')).toBeInTheDocument();
  });

  it('should display document count', () => {
    render(<ProjectCard project={mockProject} />);

    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('should call onView when card is clicked', () => {
    const onView = vi.fn();
    render(<ProjectCard project={mockProject} onView={onView} />);

    const card = screen.getByText('Test Project').closest('div');
    card?.click();

    expect(onView).toHaveBeenCalledWith(mockProject);
  });

  it('should render without description', () => {
    const projectWithoutDescription = { ...mockProject, description: undefined };
    render(<ProjectCard project={projectWithoutDescription} />);

    expect(screen.getByText('Test Project')).toBeInTheDocument();
    expect(screen.queryByText('A test project for unit testing')).not.toBeInTheDocument();
  });

  it('should show correct progress based on phase', () => {
    render(<ProjectCard project={mockProject} />);

    // Requirements phase should show 25% progress
    const progressBar = screen.getByText('25%');
    expect(progressBar).toBeInTheDocument();
  });

  it('should handle multiple team members', () => {
    const projectWithMultipleMembers = {
      ...mockProject,
      team: [
        ...mockProject.team,
        {
          id: 'team-2',
          role: TeamMemberRole.LEAD,
          status: TeamMemberStatus.ACTIVE,
          joinedAt: '2023-01-01T00:00:00Z',
          user: {
            id: 'user-2',
            name: 'Bob Johnson',
            email: 'bob@example.com',
          },
        },
      ],
      _count: {
        ...mockProject._count,
        team: 2,
      },
    };

    render(<ProjectCard project={projectWithMultipleMembers} />);

    expect(screen.getByText('2 members')).toBeInTheDocument();
  });
});