import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { PrismaClient, UserRole, SpecificationPhase, ProjectStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import projectRoutes from '../routes/project.routes.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

let response: any;

// Test database
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL_TEST || 'postgresql://postgres:postgres@localhost:5433/codementor_ai_test?schema=public',
    },
  },
});

// Test app setup
const app = express();
app.use(express.json());
app.use('/api/projects', projectRoutes);

// Test users
let testUsers: any[] = [];
let authTokens: string[] = [];

describe('Project Routes Integration Tests', () => {
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

    // Generate auth tokens
    authTokens = users.map(user => 
      jwt.sign(
        {
          userId: user.id,
          email: user.email,
          role: user.role,
          jti: `test-${user.id}`,
        },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h', issuer: 'codementor-ai', audience: 'codementor-ai-client' }
      )
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up projects before each test
    await prisma.specificationProject.deleteMany();
  });

  describe('POST /api/projects', () => {
    it('should create a new project successfully', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'A test project for integration testing',
        teamMemberIds: [testUsers[1].id],
      };

       response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authTokens[0]}`)
        .send(projectData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Project created successfully',
        data: {
          name: 'Test Project',
          description: 'A test project for integration testing',
          currentPhase: SpecificationPhase.REQUIREMENTS,
          status: ProjectStatus.ACTIVE,
          owner: {
            id: testUsers[0].id,
            name: 'Project Owner',
          },
        },
      });

      expect(response.body.data.team).toHaveLength(1);
      expect(response.body.data.documents).toHaveLength(4); // All phases
    });

    it('should require authentication', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'A test project',
      };

      await request(app)
        .post('/api/projects')
        .send(projectData)
        .expect(401);
    });

    it('should validate required fields', async () => {
       response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authTokens[0]}`)
        .send({}) // Missing name
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Validation failed',
      });
    });

    it('should validate field lengths', async () => {
      const projectData = {
        name: 'a'.repeat(101), // Too long
        description: 'Valid description',
      };

       response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authTokens[0]}`)
        .send(projectData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/projects', () => {
    beforeEach(async () => {
      // Create test projects
      await prisma.specificationProject.createMany({
        data: [
          {
            name: 'Owner Project 1',
            description: 'First project owned by test user',
            ownerId: testUsers[0].id,
            currentPhase: SpecificationPhase.REQUIREMENTS,
            status: ProjectStatus.ACTIVE,
          },
          {
            name: 'Owner Project 2',
            description: 'Second project owned by test user',
            ownerId: testUsers[0].id,
            currentPhase: SpecificationPhase.DESIGN,
            status: ProjectStatus.COMPLETED,
          },
          {
            name: 'Other User Project',
            description: 'Project owned by other user',
            ownerId: testUsers[2].id,
            currentPhase: SpecificationPhase.TASKS,
            status: ProjectStatus.ACTIVE,
          },
        ],
      });

      // Add team member to one project
      const _project = await prisma.specificationProject.findFirst({
        where: { name: 'Owner Project 1' },
      });

      if (project) {
        await prisma.teamMember.create({
          data: {
            userId: testUsers[1].id,
            projectId: project.id,
            role: 'MEMBER',
            status: 'ACTIVE',
          },
        });
      }
    });

    it('should return projects for authenticated user', async () => {
       response = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${authTokens[0]}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          projects: expect.any(Array),
          pagination: {
            page: 1,
            limit: 10,
            total: 2, // Owner has 2 projects
            pages: 1,
          },
        },
      });

      expect(response.body.data.projects).toHaveLength(2);
    });

    it('should return projects where user is team member', async () => {
       response = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${authTokens[1]}`) // Team member
        .expect(200);

      expect(response.body.data.projects).toHaveLength(1); // Member of 1 project
      expect(response.body.data.projects[0].name).toBe('Owner Project 1');
    });

    it('should support search filtering', async () => {
       response = await request(app)
        .get('/api/projects?search=First')
        .set('Authorization', `Bearer ${authTokens[0]}`)
        .expect(200);

      expect(response.body.data.projects).toHaveLength(1);
      expect(response.body.data.projects[0].name).toBe('Owner Project 1');
    });

    it('should support status filtering', async () => {
       response = await request(app)
        .get('/api/projects?status=COMPLETED')
        .set('Authorization', `Bearer ${authTokens[0]}`)
        .expect(200);

      expect(response.body.data.projects).toHaveLength(1);
      expect(response.body.data.projects[0].status).toBe(ProjectStatus.COMPLETED);
    });

    it('should support pagination', async () => {
       response = await request(app)
        .get('/api/projects?page=1&limit=1')
        .set('Authorization', `Bearer ${authTokens[0]}`)
        .expect(200);

      expect(response.body.data.projects).toHaveLength(1);
      expect(response.body.data.pagination).toMatchObject({
        page: 1,
        limit: 1,
        total: 2,
        pages: 2,
      });
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/projects')
        .expect(401);
    });
  });

  describe('GET /api/projects/:id', () => {
    let testProject: unknown;

    beforeEach(async () => {
      testProject = await prisma.specificationProject.create({
        data: {
          name: 'Detailed Test Project',
          description: 'Project for detailed view testing',
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

    it('should return project details for owner', async () => {
       response = await request(app)
        .get(`/api/projects/${testProject.id}`)
        .set('Authorization', `Bearer ${authTokens[0]}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: testProject.id,
          name: 'Detailed Test Project',
          description: 'Project for detailed view testing',
          owner: {
            id: testUsers[0].id,
            name: 'Project Owner',
          },
          documents: expect.any(Array),
          team: expect.any(Array),
        },
      });
    });

    it('should return 404 for non-existent project', async () => {
       response = await request(app)
        .get('/api/projects/non-existent-id')
        .set('Authorization', `Bearer ${authTokens[0]}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Project not found or access denied',
        code: 'PROJECT_NOT_FOUND',
      });
    });

    it('should deny access to unauthorized user', async () => {
       response = await request(app)
        .get(`/api/projects/${testProject.id}`)
        .set('Authorization', `Bearer ${authTokens[2]}`) // Other user
        .expect(404);

      expect(response.body.code).toBe('PROJECT_NOT_FOUND');
    });
  });

  describe('PUT /api/projects/:id', () => {
    let testProject: unknown;

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
      const updateData = {
        name: 'Updated Project Name',
        description: 'Updated description',
        currentPhase: SpecificationPhase.DESIGN,
        status: ProjectStatus.COMPLETED,
      };

       response = await request(app)
        .put(`/api/projects/${testProject.id}`)
        .set('Authorization', `Bearer ${authTokens[0]}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Project updated successfully',
        data: {
          name: 'Updated Project Name',
          description: 'Updated description',
          currentPhase: SpecificationPhase.DESIGN,
          status: ProjectStatus.COMPLETED,
        },
      });
    });

    it('should allow partial updates', async () => {
      const updateData = {
        name: 'Partially Updated Name',
      };

       response = await request(app)
        .put(`/api/projects/${testProject.id}`)
        .set('Authorization', `Bearer ${authTokens[0]}`)
        .send(updateData)
        .expect(200);

      expect(response.body.data.name).toBe('Partially Updated Name');
      expect(response.body.data.description).toBe('Project for update testing'); // Unchanged
    });

    it('should deny access to non-owner', async () => {
      const updateData = {
        name: 'Unauthorized Update',
      };

       response = await request(app)
        .put(`/api/projects/${testProject.id}`)
        .set('Authorization', `Bearer ${authTokens[2]}`) // Other user
        .send(updateData)
        .expect(404);

      expect(response.body.code).toBe('PROJECT_NOT_FOUND');
    });
  });

  describe('DELETE /api/projects/:id', () => {
    let testProject: unknown;

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
       response = await request(app)
        .delete(`/api/projects/${testProject.id}`)
        .set('Authorization', `Bearer ${authTokens[0]}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Project deleted successfully',
      });

      // Verify project is deleted
      const deletedProject = await prisma.specificationProject.findUnique({
        where: { id: testProject.id },
      });
      expect(deletedProject).toBeNull();
    });

    it('should deny deletion to non-owner', async () => {
       response = await request(app)
        .delete(`/api/projects/${testProject.id}`)
        .set('Authorization', `Bearer ${authTokens[1]}`) // Team member
        .expect(404);

      expect(response.body.code).toBe('PROJECT_NOT_FOUND');
    });
  });

  describe('Team Management', () => {
    let testProject: unknown;

    beforeEach(async () => {
      testProject = await prisma.specificationProject.create({
        data: {
          name: 'Team Management Test Project',
          description: 'Project for team management testing',
          ownerId: testUsers[0].id,
        },
      });
    });

    describe('POST /api/projects/:id/team', () => {
      it('should add team member successfully', async () => {
        const teamMemberData = {
          userId: testUsers[1].id,
          role: 'MEMBER',
        };

         response = await request(app)
          .post(`/api/projects/${testProject.id}/team`)
          .set('Authorization', `Bearer ${authTokens[0]}`)
          .send(teamMemberData)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          message: 'Team member added successfully',
        });

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

        const teamMemberData = {
          userId: testUsers[1].id,
          role: 'LEAD',
        };

         response = await request(app)
          .post(`/api/projects/${testProject.id}/team`)
          .set('Authorization', `Bearer ${authTokens[0]}`)
          .send(teamMemberData)
          .expect(409);

        expect(response.body.code).toBe('ALREADY_TEAM_MEMBER');
      });

      it('should deny access to non-owner', async () => {
        const teamMemberData = {
          userId: testUsers[2].id,
          role: 'MEMBER',
        };

         response = await request(app)
          .post(`/api/projects/${testProject.id}/team`)
          .set('Authorization', `Bearer ${authTokens[1]}`) // Non-owner
          .send(teamMemberData)
          .expect(404);

        expect(response.body.code).toBe('PROJECT_NOT_FOUND');
      });
    });

    describe('DELETE /api/projects/:id/team/:memberId', () => {
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
         response = await request(app)
          .delete(`/api/projects/${testProject.id}/team/${testUsers[1].id}`)
          .set('Authorization', `Bearer ${authTokens[0]}`)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          message: 'Team member removed successfully',
        });

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
         response = await request(app)
          .delete(`/api/projects/${testProject.id}/team/${testUsers[0].id}`)
          .set('Authorization', `Bearer ${authTokens[0]}`)
          .expect(400);

        expect(response.body.code).toBe('CANNOT_REMOVE_OWNER');
      });
    });
  });

  describe('GET /api/projects/:id/analytics', () => {
    let testProject: unknown;

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
       response = await request(app)
        .get(`/api/projects/${testProject.id}/analytics`)
        .set('Authorization', `Bearer ${authTokens[0]}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          documentCount: expect.any(String),
          activeTeamMembers: expect.any(String),
        }),
      });
    });

    it('should deny access to unauthorized user', async () => {
       response = await request(app)
        .get(`/api/projects/${testProject.id}/analytics`)
        .set('Authorization', `Bearer ${authTokens[2]}`) // Other user
        .expect(404);

      expect(response.body.code).toBe('PROJECT_NOT_FOUND');
    });
  });
});