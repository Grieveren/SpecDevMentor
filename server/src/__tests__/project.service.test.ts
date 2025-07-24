import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { PrismaClient, UserRole, SpecificationPhase, DocumentStatus, ProjectStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { ProjectService, CreateProjectRequest, UpdateProjectRequest, ProjectError } from '../services/project.service.js';

// Test database
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL_TEST || 'postgresql://postgres:postgres@localhost:5433/codementor_ai_test?schema=public',
    },
  },
});

const projectService = new ProjectService(prisma); // No Redis for testing

// Test users
let testUsers: any[] = [];

describe('Project Service Tests', () => {
  beforeAll(async () => {
    // Clean up test database
    await prisma.$executeRaw`TRUNCATE TABLE "users", "specification_projects", "specification_documents", "team_members" RESTART IDENTITY CASCADE`;

    // Create test users
    const hashedPassword = await bcrypt.hash('testpassword', 12);
    
    const users = await Promise.all([
      prisma.user.create({
        data: {
          email: 'owner@test.com',
          name: 'Project Owner',
          password: hashedPassword,
          role: UserRole.TEAM_LEAD,
          isVerified: true,
        },
      }),
      prisma.user.create({
        data: {
          email: 'member@test.com',
          name: 'Team Member',
          password: hashedPassword,
          role: UserRole.DEVELOPER,
          isVerified: true,
        },
      }),
      prisma.user.create({
        data: {
          email: 'other@test.com',
          name: 'Other User',
          password: hashedPassword,
          role: UserRole.DEVELOPER,
          isVerified: true,
        },
      }),
    ]);

    testUsers = users;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up projects before each test
    await prisma.specificationProject.deleteMany();
  });

  describe('createProject', () => {
    it('should create a new project with initial documents', async () => {
      const projectData: CreateProjectRequest = {
        name: 'Test Project',
        description: 'A test project for service testing',
        teamMemberIds: [testUsers[1].id],
      };

      const project = await projectService.createProject(projectData, testUsers[0].id);

      expect(project).toMatchObject({
        name: 'Test Project',
        description: 'A test project for service testing',
        currentPhase: SpecificationPhase.REQUIREMENTS,
        status: ProjectStatus.ACTIVE,
        owner: {
          id: testUsers[0].id,
          name: 'Project Owner',
        },
      });

      expect(project.team).toHaveLength(1);
      expect(project.documents).toHaveLength(4); // All phases
      expect(project.documents.map(d => d.phase)).toEqual([
        SpecificationPhase.REQUIREMENTS,
        SpecificationPhase.DESIGN,
        SpecificationPhase.TASKS,
        SpecificationPhase.IMPLEMENTATION,
      ]);
    });

    it('should create project without team members', async () => {
      const projectData: CreateProjectRequest = {
        name: 'Solo Project',
        description: 'A project without team members',
      };

      const project = await projectService.createProject(projectData, testUsers[0].id);

      expect(project.name).toBe('Solo Project');
      expect(project.team).toHaveLength(0);
      expect(project.documents).toHaveLength(4);
    });
  });

  describe('getProjectById', () => {
    let testProject: any;

    beforeEach(async () => {
      testProject = await prisma.specificationProject.create({
        data: {
          name: 'Get Test Project',
          description: 'Project for get testing',
          ownerId: testUsers[0].id,
        },
      });

      // Create documents
      await prisma.specificationDocument.createMany({
        data: [
          {
            projectId: testProject.id,
            phase: SpecificationPhase.REQUIREMENTS,
            content: 'Requirements content',
          },
          {
            projectId: testProject.id,
            phase: SpecificationPhase.DESIGN,
            content: 'Design content',
          },
        ],
      });
    });

    it('should return project for owner', async () => {
      const project = await projectService.getProjectById(testProject.id, testUsers[0].id);

      expect(project).toMatchObject({
        id: testProject.id,
        name: 'Get Test Project',
        description: 'Project for get testing',
        owner: {
          id: testUsers[0].id,
          name: 'Project Owner',
        },
      });

      expect(project.documents).toHaveLength(2);
      expect(project.team).toHaveLength(0);
    });

    it('should return project for team member', async () => {
      // Add team member
      await prisma.teamMember.create({
        data: {
          userId: testUsers[1].id,
          projectId: testProject.id,
          role: 'MEMBER',
          status: 'ACTIVE',
        },
      });

      const project = await projectService.getProjectById(testProject.id, testUsers[1].id);

      expect(project.id).toBe(testProject.id);
      expect(project.team).toHaveLength(1);
    });

    it('should throw error for unauthorized user', async () => {
      await expect(
        projectService.getProjectById(testProject.id, testUsers[2].id)
      ).rejects.toThrow(new ProjectError('Project not found or access denied', 'PROJECT_NOT_FOUND', 404));
    });

    it('should throw error for non-existent project', async () => {
      await expect(
        projectService.getProjectById('non-existent-id', testUsers[0].id)
      ).rejects.toThrow(new ProjectError('Project not found or access denied', 'PROJECT_NOT_FOUND', 404));
    });
  });

  describe('getProjectsForUser', () => {
    beforeEach(async () => {
      // Create test projects
      const projects = await Promise.all([
        prisma.specificationProject.create({
          data: {
            name: 'Owner Project 1',
            description: 'First project owned by test user',
            ownerId: testUsers[0].id,
            currentPhase: SpecificationPhase.REQUIREMENTS,
            status: ProjectStatus.ACTIVE,
          },
        }),
        prisma.specificationProject.create({
          data: {
            name: 'Owner Project 2',
            description: 'Second project owned by test user',
            ownerId: testUsers[0].id,
            currentPhase: SpecificationPhase.DESIGN,
            status: ProjectStatus.COMPLETED,
          },
        }),
        prisma.specificationProject.create({
          data: {
            name: 'Other User Project',
            description: 'Project owned by other user',
            ownerId: testUsers[2].id,
            currentPhase: SpecificationPhase.TASKS,
            status: ProjectStatus.ACTIVE,
          },
        }),
      ]);

      // Add team member to one project
      await prisma.teamMember.create({
        data: {
          userId: testUsers[1].id,
          projectId: projects[0].id,
          role: 'MEMBER',
          status: 'ACTIVE',
        },
      });
    });

    it('should return projects for owner', async () => {
      const result = await projectService.getProjectsForUser(testUsers[0].id);

      expect(result.projects).toHaveLength(2);
      expect(result.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: 2,
        pages: 1,
      });
    });

    it('should return projects where user is team member', async () => {
      const result = await projectService.getProjectsForUser(testUsers[1].id);

      expect(result.projects).toHaveLength(1);
      expect(result.projects[0].name).toBe('Owner Project 1');
    });

    it('should support search filtering', async () => {
      const result = await projectService.getProjectsForUser(
        testUsers[0].id,
        { search: 'First' }
      );

      expect(result.projects).toHaveLength(1);
      expect(result.projects[0].name).toBe('Owner Project 1');
    });

    it('should support status filtering', async () => {
      const result = await projectService.getProjectsForUser(
        testUsers[0].id,
        { status: ProjectStatus.COMPLETED }
      );

      expect(result.projects).toHaveLength(1);
      expect(result.projects[0].status).toBe(ProjectStatus.COMPLETED);
    });

    it('should support pagination', async () => {
      const result = await projectService.getProjectsForUser(
        testUsers[0].id,
        {},
        { page: 1, limit: 1 }
      );

      expect(result.projects).toHaveLength(1);
      expect(result.pagination).toMatchObject({
        page: 1,
        limit: 1,
        total: 2,
        pages: 2,
      });
    });
  });

  describe('updateProject', () => {
    let testProject: any;

    beforeEach(async () => {
      testProject = await prisma.specificationProject.create({
        data: {
          name: 'Update Test Project',
          description: 'Project for update testing',
          ownerId: testUsers[0].id,
        },
      });
    });

    it('should update project successfully', async () => {
      const updateData: UpdateProjectRequest = {
        name: 'Updated Project Name',
        description: 'Updated description',
        currentPhase: SpecificationPhase.DESIGN,
        status: ProjectStatus.COMPLETED,
      };

      const project = await projectService.updateProject(testProject.id, updateData, testUsers[0].id);

      expect(project).toMatchObject({
        name: 'Updated Project Name',
        description: 'Updated description',
        currentPhase: SpecificationPhase.DESIGN,
        status: ProjectStatus.COMPLETED,
      });
    });

    it('should allow partial updates', async () => {
      const updateData: UpdateProjectRequest = {
        name: 'Partially Updated Name',
      };

      const project = await projectService.updateProject(testProject.id, updateData, testUsers[0].id);

      expect(project.name).toBe('Partially Updated Name');
      expect(project.description).toBe('Project for update testing'); // Unchanged
    });

    it('should deny access to non-owner', async () => {
      const updateData: UpdateProjectRequest = {
        name: 'Unauthorized Update',
      };

      await expect(
        projectService.updateProject(testProject.id, updateData, testUsers[2].id)
      ).rejects.toThrow(new ProjectError('Project not found or access denied', 'PROJECT_NOT_FOUND', 404));
    });
  });

  describe('deleteProject', () => {
    let testProject: any;

    beforeEach(async () => {
      testProject = await prisma.specificationProject.create({
        data: {
          name: 'Delete Test Project',
          description: 'Project for delete testing',
          ownerId: testUsers[0].id,
        },
      });
    });

    it('should delete project successfully', async () => {
      await projectService.deleteProject(testProject.id, testUsers[0].id);

      // Verify project is deleted
      const deletedProject = await prisma.specificationProject.findUnique({
        where: { id: testProject.id },
      });
      expect(deletedProject).toBeNull();
    });

    it('should deny deletion to non-owner', async () => {
      await expect(
        projectService.deleteProject(testProject.id, testUsers[1].id)
      ).rejects.toThrow(new ProjectError('Project not found or access denied', 'PROJECT_NOT_FOUND', 404));
    });
  });

  describe('Team Management', () => {
    let testProject: any;

    beforeEach(async () => {
      testProject = await prisma.specificationProject.create({
        data: {
          name: 'Team Management Test Project',
          description: 'Project for team management testing',
          ownerId: testUsers[0].id,
        },
      });
    });

    describe('addTeamMember', () => {
      it('should add team member successfully', async () => {
        await projectService.addTeamMember(
          testProject.id,
          { userId: testUsers[1].id, role: 'MEMBER' },
          testUsers[0].id
        );

        // Verify team member was added
        const teamMember = await prisma.teamMember.findUnique({
          where: {
            userId_projectId: {
              userId: testUsers[1].id,
              projectId: testProject.id,
            },
          },
        });
        expect(teamMember).toBeTruthy();
        expect(teamMember?.role).toBe('MEMBER');
      });

      it('should prevent duplicate team members', async () => {
        // Add team member first
        await prisma.teamMember.create({
          data: {
            userId: testUsers[1].id,
            projectId: testProject.id,
            role: 'MEMBER',
            status: 'ACTIVE',
          },
        });

        await expect(
          projectService.addTeamMember(
            testProject.id,
            { userId: testUsers[1].id, role: 'LEAD' },
            testUsers[0].id
          )
        ).rejects.toThrow(new ProjectError('User is already a team member', 'ALREADY_TEAM_MEMBER', 409));
      });

      it('should deny access to non-owner', async () => {
        await expect(
          projectService.addTeamMember(
            testProject.id,
            { userId: testUsers[2].id, role: 'MEMBER' },
            testUsers[1].id
          )
        ).rejects.toThrow(new ProjectError('Project not found or access denied', 'PROJECT_NOT_FOUND', 404));
      });
    });

    describe('removeTeamMember', () => {
      beforeEach(async () => {
        // Add team member
        await prisma.teamMember.create({
          data: {
            userId: testUsers[1].id,
            projectId: testProject.id,
            role: 'MEMBER',
            status: 'ACTIVE',
          },
        });
      });

      it('should remove team member successfully', async () => {
        await projectService.removeTeamMember(testProject.id, testUsers[1].id, testUsers[0].id);

        // Verify team member status changed to inactive
        const teamMember = await prisma.teamMember.findUnique({
          where: {
            userId_projectId: {
              userId: testUsers[1].id,
              projectId: testProject.id,
            },
          },
        });
        expect(teamMember?.status).toBe('INACTIVE');
      });

      it('should prevent removing project owner', async () => {
        await expect(
          projectService.removeTeamMember(testProject.id, testUsers[0].id, testUsers[0].id)
        ).rejects.toThrow(new ProjectError('Cannot remove project owner from team', 'CANNOT_REMOVE_OWNER', 400));
      });
    });
  });

  describe('getProjectAnalytics', () => {
    let testProject: any;

    beforeEach(async () => {
      testProject = await prisma.specificationProject.create({
        data: {
          name: 'Analytics Test Project',
          description: 'Project for analytics testing',
          ownerId: testUsers[0].id,
        },
      });

      // Create some test data for analytics
      await prisma.specificationDocument.create({
        data: {
          projectId: testProject.id,
          phase: SpecificationPhase.REQUIREMENTS,
          content: 'Test content',
        },
      });

      await prisma.teamMember.create({
        data: {
          userId: testUsers[1].id,
          projectId: testProject.id,
          role: 'MEMBER',
          status: 'ACTIVE',
        },
      });
    });

    it('should return project analytics', async () => {
      const analytics = await projectService.getProjectAnalytics(testProject.id, testUsers[0].id);

      expect(analytics).toMatchObject({
        documentCount: expect.any(BigInt),
        activeTeamMembers: expect.any(BigInt),
      });
    });

    it('should deny access to unauthorized user', async () => {
      await expect(
        projectService.getProjectAnalytics(testProject.id, testUsers[2].id)
      ).rejects.toThrow(new ProjectError('Project not found or access denied', 'PROJECT_NOT_FOUND', 404));
    });
  });
});