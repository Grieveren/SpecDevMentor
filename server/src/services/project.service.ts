import { PrismaClient, SpecificationProject, SpecificationPhase, ProjectStatus, DocumentStatus, TeamMemberRole, TeamMemberStatus, Prisma } from '@prisma/client';
import Redis from 'ioredis';

export interface CreateProjectRequest {
  name: string;
  description?: string;
  teamMemberIds?: string[];
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  currentPhase?: SpecificationPhase;
  status?: ProjectStatus;
}

export interface ProjectFilters {
  search?: string;
  status?: ProjectStatus;
  phase?: SpecificationPhase;
  ownerId?: string;
}

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginatedProjects {
  projects: ProjectWithDetails[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface ProjectWithDetails extends SpecificationProject {
  owner: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  team: Array<{
    id: string;
    role: TeamMemberRole;
    status: TeamMemberStatus;
    joinedAt: Date;
    user: {
      id: string;
      name: string;
      email: string;
      avatar?: string;
    };
  }>;
  documents: Array<{
    id: string;
    phase: SpecificationPhase;
    status: DocumentStatus;
    version: number;
    updatedAt: Date;
  }>;
  _count: {
    documents: number;
    team: number;
  };
}

export interface AddTeamMemberRequest {
  userId: string;
  role: TeamMemberRole;
}

export class ProjectError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'ProjectError';
  }
}

export class ProjectService {
  constructor(
    private prisma: PrismaClient,
    private redis?: Redis
  ) {}

  async createProject(_data: CreateProjectRequest, ownerId: string): Promise<ProjectWithDetails> {
    try {
      const _project = await this.prisma.$transaction(async (tx) => {
        // Create project
        const newProject = await tx.specificationProject.create({
          data: {
            name: data.name,
            description: data.description,
            ownerId,
            currentPhase: SpecificationPhase.REQUIREMENTS,
            status: ProjectStatus.ACTIVE,
          },
        });

        // Create initial documents for each phase
        const phases: SpecificationPhase[] = [
          SpecificationPhase.REQUIREMENTS,
          SpecificationPhase.DESIGN,
          SpecificationPhase.TASKS,
          SpecificationPhase.IMPLEMENTATION,
        ];

        await Promise.all(
          phases.map((phase) =>
            tx.specificationDocument.create({
              data: {
                projectId: newProject.id,
                phase,
                content: this.getInitialContent(phase),
                status: phase === SpecificationPhase.REQUIREMENTS ? DocumentStatus.DRAFT : DocumentStatus.DRAFT,
              },
            })
          )
        );

        // Add team members if specified
        if (data.teamMemberIds?.length) {
          await tx.teamMember.createMany({
            data: data.teamMemberIds.map((memberId) => ({
              projectId: newProject.id,
              userId: memberId,
              role: TeamMemberRole.MEMBER,
              status: TeamMemberStatus.ACTIVE,
            })),
          });
        }

        return newProject;
      });

      // Invalidate cache
      await this.invalidateProjectCache(ownerId);

      // Fetch and return the complete project
      return await this.getProjectById(project.id, ownerId);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ProjectError('Project name must be unique', 'PROJECT_NAME_EXISTS', 409);
        }
      }
      throw new ProjectError('Failed to create project', 'CREATE_FAILED', 500);
    }
  }

  async getProjectById(projectId: string, userId: string): Promise<ProjectWithDetails> {
    const cacheKey = `project:${projectId}:user:${userId}`;

    // Try cache first
    if (this.redis) {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    const _project = await this.prisma.specificationProject.findFirst({
      where: {
        id: projectId,
        OR: [
          { ownerId: userId },
          { team: { some: { userId, status: TeamMemberStatus.ACTIVE } } },
        ],
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        team: {
          where: { status: TeamMemberStatus.ACTIVE },
          include: {
            user: {
              select: { id: true, name: true, email: true, avatar: true },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
        documents: {
          select: {
            id: true,
            phase: true,
            status: true,
            version: true,
            updatedAt: true,
          },
          orderBy: { phase: 'asc' },
        },
        _count: {
          select: {
            documents: true,
            team: true,
          },
        },
      },
    });

    if (!project) {
      throw new ProjectError('Project not found or access denied', 'PROJECT_NOT_FOUND', 404);
    }

    // Cache result
    if (this.redis) {
      await this.redis.setex(cacheKey, 300, JSON.stringify(project)); // 5 minutes
    }

    return project as ProjectWithDetails;
  }

  async getProjectsForUser(
    userId: string,
    filters: ProjectFilters = {},
    pagination: PaginationOptions = { page: 1, limit: 10 }
  ): Promise<PaginatedProjects> {
    const { search, status, phase, ownerId } = filters;
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const where: Prisma.SpecificationProjectWhereInput = {
      OR: [
        { ownerId: userId },
        { team: { some: { userId, status: TeamMemberStatus.ACTIVE } } },
      ],
      ...(status && { status }),
      ...(phase && { currentPhase: phase }),
      ...(ownerId && { ownerId }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [projects, total] = await Promise.all([
      this.prisma.specificationProject.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          owner: {
            select: { id: true, name: true, email: true, avatar: true },
          },
          team: {
            where: { status: TeamMemberStatus.ACTIVE },
            include: {
              user: {
                select: { id: true, name: true, email: true, avatar: true },
              },
            },
            take: 5, // Limit team members in list view
          },
          documents: {
            select: {
              id: true,
              phase: true,
              status: true,
              version: true,
              updatedAt: true,
            },
          },
          _count: {
            select: {
              documents: true,
              team: true,
            },
          },
        },
      }),
      this.prisma.specificationProject.count({ where }),
    ]);

    return {
      projects: projects as ProjectWithDetails[],
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async updateProject(
    projectId: string,
    data: UpdateProjectRequest,
    userId: string
  ): Promise<ProjectWithDetails> {
    // Check if user has permission to update
    const existingProject = await this.getProjectById(projectId, userId);
    
    if (existingProject.ownerId !== userId) {
      // Check if user is a team lead
      const teamMember = existingProject.team.find(
        (member) => member.user.id === userId && member.role === TeamMemberRole.LEAD
      );
      
      if (!teamMember) {
        throw new ProjectError('Insufficient permissions to update project', 'INSUFFICIENT_PERMISSIONS', 403);
      }
    }

    try {
      await this.prisma.specificationProject.update({
        where: { id: projectId },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.currentPhase && { currentPhase: data.currentPhase }),
          ...(data.status && { status: data.status }),
          updatedAt: new Date(),
        },
      });

      // Invalidate cache
      await this.invalidateProjectCache(userId);

      return await this.getProjectById(projectId, userId);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ProjectError('Project name must be unique', 'PROJECT_NAME_EXISTS', 409);
        }
      }
      throw new ProjectError('Failed to update project', 'UPDATE_FAILED', 500);
    }
  }

  async deleteProject(projectId: string, userId: string): Promise<void> {
    const _project = await this.getProjectById(projectId, userId);
    
    if (project.ownerId !== userId) {
      throw new ProjectError('Only project owner can delete the project', 'INSUFFICIENT_PERMISSIONS', 403);
    }

    try {
      await this.prisma.specificationProject.delete({
        where: { id: projectId },
      });

      // Invalidate cache
      await this.invalidateProjectCache(userId);
    } catch (error) {
      throw new ProjectError('Failed to delete project', 'DELETE_FAILED', 500);
    }
  }

  async addTeamMember(
    projectId: string,
    data: AddTeamMemberRequest,
    userId: string
  ): Promise<void> {
    const _project = await this.getProjectById(projectId, userId);
    
    // Check permissions
    if (project.ownerId !== userId) {
      const teamMember = project.team.find(
        (member) => member.user.id === userId && member.role === TeamMemberRole.LEAD
      );
      
      if (!teamMember) {
        throw new ProjectError('Insufficient permissions to add team members', 'INSUFFICIENT_PERMISSIONS', 403);
      }
    }

    // Check if user is already a team member
    const existingMember = await this.prisma.teamMember.findUnique({
      where: {
        userId_projectId: {
          userId: data.userId,
          projectId,
        },
      },
    });

    if (existingMember) {
      if (existingMember.status === TeamMemberStatus.ACTIVE) {
        throw new ProjectError('User is already a team member', 'ALREADY_TEAM_MEMBER', 409);
      } else {
        // Reactivate existing member
        await this.prisma.teamMember.update({
          where: { id: existingMember.id },
          data: {
            status: TeamMemberStatus.ACTIVE,
            role: data.role,
            joinedAt: new Date(),
          },
        });
      }
    } else {
      // Add new team member
      await this.prisma.teamMember.create({
        data: {
          userId: data.userId,
          projectId,
          role: data.role,
          status: TeamMemberStatus.ACTIVE,
        },
      });
    }

    // Invalidate cache
    await this.invalidateProjectCache(userId);
  }

  async removeTeamMember(projectId: string, memberId: string, userId: string): Promise<void> {
    const _project = await this.getProjectById(projectId, userId);
    
    // Check permissions
    if (project.ownerId !== userId) {
      const teamMember = project.team.find(
        (member) => member.user.id === userId && member.role === TeamMemberRole.LEAD
      );
      
      if (!teamMember) {
        throw new ProjectError('Insufficient permissions to remove team members', 'INSUFFICIENT_PERMISSIONS', 403);
      }
    }

    // Cannot remove project owner
    if (memberId === project.ownerId) {
      throw new ProjectError('Cannot remove project owner from team', 'CANNOT_REMOVE_OWNER', 400);
    }

    await this.prisma.teamMember.updateMany({
      where: {
        userId: memberId,
        projectId,
      },
      data: {
        status: TeamMemberStatus.INACTIVE,
      },
    });

    // Invalidate cache
    await this.invalidateProjectCache(userId);
  }

  async getProjectAnalytics(projectId: string, userId: string): Promise<any> {
    const _project = await this.getProjectById(projectId, userId);

    const analytics = await this.prisma.$queryRaw`
      SELECT 
        COUNT(DISTINCT d.id) as "documentCount",
        COUNT(DISTINCT ct.id) as "commentThreadCount",
        COUNT(DISTINCT c.id) as "commentCount",
        COUNT(DISTINCT tm.id) as "activeTeamMembers",
        AVG(ar."overallScore") as "averageQualityScore",
        MAX(d."updatedAt") as "lastActivity"
      FROM specification_projects p
      LEFT JOIN specification_documents d ON p.id = d."projectId"
      LEFT JOIN comment_threads ct ON d.id = ct."documentId"
      LEFT JOIN comments c ON ct.id = c."threadId"
      LEFT JOIN team_members tm ON p.id = tm."projectId" AND tm.status = 'ACTIVE'
      LEFT JOIN ai_reviews ar ON d.id = ar."documentId"
      WHERE p.id = ${projectId}
      GROUP BY p.id
    `;

    return analytics[0] || {};
  }

  private getInitialContent(phase: SpecificationPhase): string {
    const templates = {
      [SpecificationPhase.REQUIREMENTS]: `# Requirements Document

## Introduction

[Provide a brief overview of the project and its objectives]

## Requirements

### Requirement 1: [Requirement Title]

**User Story:** As a [role], I want [feature], so that [benefit]

#### Acceptance Criteria

1. WHEN [event] THEN [system] SHALL [response]
2. IF [condition] THEN [system] SHALL [response]

`,
      [SpecificationPhase.DESIGN]: `# Design Document

## Overview

[High-level description of the system design]

## Architecture

[System architecture and components]

## Data Models

[Database schema and data structures]

## API Design

[API endpoints and interfaces]

## Error Handling

[Error handling strategy]

## Testing Strategy

[Testing approach and coverage]

`,
      [SpecificationPhase.TASKS]: `# Implementation Plan

- [ ] 1. [Task Category]
  - [ ] 1.1 [Specific Task]
    - [Task details and requirements]
    - _Requirements: [Reference to requirements]_

`,
      [SpecificationPhase.IMPLEMENTATION]: `# Implementation Notes

## Completed Features

[List of implemented features]

## Current Status

[Current implementation status]

## Next Steps

[Upcoming implementation tasks]

`,
    };

    return templates[phase] || '';
  }

  private async invalidateProjectCache(userId: string): Promise<void> {
    if (!this.redis) return;

    const pattern = `project:*:user:${userId}`;
    const keys = await this.redis.keys(pattern);

    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}