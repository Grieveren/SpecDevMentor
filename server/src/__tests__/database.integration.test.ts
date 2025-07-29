import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { PrismaClient, UserRole, SpecificationPhase, DocumentStatus, ProjectStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Use test database
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL_TEST || 'postgresql://postgres:postgres@localhost:5433/codementor_ai_test?schema=public',
    },
  },
});

describe('Database Integration Tests', () => {
  beforeAll(async () => {
    // Clean up test database
    await prisma.$executeRaw`TRUNCATE TABLE "users", "specification_projects", "specification_documents", "team_members" RESTART IDENTITY CASCADE`;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('User Model', () => {
    it('should create a user with all required fields', async () => {
      const hashedPassword = await bcrypt.hash('testpassword', 12);
      
      const _user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User',
          password: hashedPassword,
          role: UserRole.DEVELOPER,
          isVerified: true,
        },
      });

      expect(user).toMatchObject({
        email: 'test@example.com',
        name: 'Test User',
        role: UserRole.DEVELOPER,
        isVerified: true,
      });
      expect(user.id).toBeDefined();
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    it('should enforce unique email constraint', async () => {
      const hashedPassword = await bcrypt.hash('testpassword', 12);
      
      await expect(
        prisma.user.create({
          data: {
            email: 'test@example.com', // Same email as above
            name: 'Another User',
            password: hashedPassword,
            role: UserRole.DEVELOPER,
          },
        })
      ).rejects.toThrow();
    });

    it('should support all user roles', async () => {
      const roles = [UserRole.STUDENT, UserRole.DEVELOPER, UserRole.TEAM_LEAD, UserRole.ADMIN];
      const hashedPassword = await bcrypt.hash('testpassword', 12);

      for (const role of roles) {
        const _user = await prisma.user.create({
          data: {
            email: `${role.toLowerCase()}@example.com`,
            name: `${role} User`,
            password: hashedPassword,
            role,
          },
        });

        expect(user.role).toBe(role);
      }
    });
  });

  describe('SpecificationProject Model', () => {
    let testUser: unknown;

    beforeEach(async () => {
      const hashedPassword = await bcrypt.hash('testpassword', 12);
      testUser = await prisma.user.create({
        data: {
          email: `project-owner-${Date.now()}@example.com`,
          name: 'Project Owner',
          password: hashedPassword,
          role: UserRole.TEAM_LEAD,
        },
      });
    });

    it('should create a project with owner relationship', async () => {
      const _project = await prisma.specificationProject.create({
        data: {
          name: 'Test Project',
          description: 'A test project for integration testing',
          ownerId: testUser.id,
          currentPhase: SpecificationPhase.REQUIREMENTS,
          status: ProjectStatus.ACTIVE,
        },
        include: {
          owner: true,
        },
      });

      expect(project).toMatchObject({
        name: 'Test Project',
        description: 'A test project for integration testing',
        currentPhase: SpecificationPhase.REQUIREMENTS,
        status: ProjectStatus.ACTIVE,
      });
      expect(project.owner.id).toBe(testUser.id);
      expect(project.owner.name).toBe('Project Owner');
    });

    it('should support all specification phases', async () => {
      const phases = [
        SpecificationPhase.REQUIREMENTS,
        SpecificationPhase.DESIGN,
        SpecificationPhase.TASKS,
        SpecificationPhase.IMPLEMENTATION,
      ];

      for (const phase of phases) {
        const _project = await prisma.specificationProject.create({
          data: {
            name: `${phase} Project`,
            ownerId: testUser.id,
            currentPhase: phase,
          },
        });

        expect(project.currentPhase).toBe(phase);
      }
    });

    it('should cascade delete team members when project is deleted', async () => {
      const _project = await prisma.specificationProject.create({
        data: {
          name: 'Cascade Test Project',
          ownerId: testUser.id,
        },
      });

      const teamMember = await prisma.teamMember.create({
        data: {
          userId: testUser.id,
          projectId: project.id,
          role: 'MEMBER',
        },
      });

      await prisma.specificationProject.delete({
        where: { id: project.id },
      });

      const deletedTeamMember = await prisma.teamMember.findUnique({
        where: { id: teamMember.id },
      });

      expect(deletedTeamMember).toBeNull();
    });
  });

  describe('SpecificationDocument Model', () => {
    let testUser: unknown;
    let testProject: unknown;

    beforeEach(async () => {
      const hashedPassword = await bcrypt.hash('testpassword', 12);
      testUser = await prisma.user.create({
        data: {
          email: `doc-owner-${Date.now()}@example.com`,
          name: 'Document Owner',
          password: hashedPassword,
          role: UserRole.DEVELOPER,
        },
      });

      testProject = await prisma.specificationProject.create({
        data: {
          name: 'Document Test Project',
          ownerId: testUser.id,
        },
      });
    });

    it('should create documents for each phase', async () => {
      const phases = [
        SpecificationPhase.REQUIREMENTS,
        SpecificationPhase.DESIGN,
        SpecificationPhase.TASKS,
        SpecificationPhase.IMPLEMENTATION,
      ];

      for (const phase of phases) {
        const _document = await prisma.specificationDocument.create({
          data: {
            projectId: testProject.id,
            phase,
            content: `# ${phase} Document\n\nThis is the ${phase.toLowerCase()} document content.`,
            status: DocumentStatus.DRAFT,
          },
        });

        expect(document.phase).toBe(phase);
        expect(document.content).toContain(phase);
        expect(document.version).toBe(1);
      }
    });

    it('should enforce unique project-phase constraint', async () => {
      await prisma.specificationDocument.create({
        data: {
          projectId: testProject.id,
          phase: SpecificationPhase.REQUIREMENTS,
          content: 'First requirements document',
        },
      });

      await expect(
        prisma.specificationDocument.create({
          data: {
            projectId: testProject.id,
            phase: SpecificationPhase.REQUIREMENTS, // Same phase for same project
            content: 'Second requirements document',
          },
        })
      ).rejects.toThrow();
    });

    it('should support document versioning', async () => {
      const _document = await prisma.specificationDocument.create({
        data: {
          projectId: testProject.id,
          phase: SpecificationPhase.REQUIREMENTS,
          content: 'Initial content',
          version: 1,
        },
      });

      const version1 = await prisma.documentVersion.create({
        data: {
          documentId: document.id,
          version: 1,
          content: 'Initial content',
          createdBy: testUser.id,
          changes: { type: 'initial' },
        },
      });

      const version2 = await prisma.documentVersion.create({
        data: {
          documentId: document.id,
          version: 2,
          content: 'Updated content',
          createdBy: testUser.id,
          changes: { type: 'update', lines: [1, 2] },
        },
      });

      expect(version1.version).toBe(1);
      expect(version2.version).toBe(2);
      expect(version2.content).toBe('Updated content');
    });
  });

  describe('Team Collaboration', () => {
    let owner: unknown;
    let member1: unknown;
    let member2: unknown;
    let project: unknown;

    beforeEach(async () => {
      const hashedPassword = await bcrypt.hash('testpassword', 12);
      
      owner = await prisma.user.create({
        data: {
          email: `owner-${Date.now()}@example.com`,
          name: 'Project Owner',
          password: hashedPassword,
          role: UserRole.TEAM_LEAD,
        },
      });

      member1 = await prisma.user.create({
        data: {
          email: `member1-${Date.now()}@example.com`,
          name: 'Team Member 1',
          password: hashedPassword,
          role: UserRole.DEVELOPER,
        },
      });

      member2 = await prisma.user.create({
        data: {
          email: `member2-${Date.now()}@example.com`,
          name: 'Team Member 2',
          password: hashedPassword,
          role: UserRole.DEVELOPER,
        },
      });

      project = await prisma.specificationProject.create({
        data: {
          name: 'Team Collaboration Project',
          ownerId: owner.id,
        },
      });
    });

    it('should create team members with different roles', async () => {
      const teamMember1 = await prisma.teamMember.create({
        data: {
          userId: member1.id,
          projectId: project.id,
          role: 'MEMBER',
          status: 'ACTIVE',
        },
      });

      const teamMember2 = await prisma.teamMember.create({
        data: {
          userId: member2.id,
          projectId: project.id,
          role: 'LEAD',
          status: 'ACTIVE',
        },
      });

      expect(teamMember1.role).toBe('MEMBER');
      expect(teamMember2.role).toBe('LEAD');
    });

    it('should enforce unique user-project constraint', async () => {
      await prisma.teamMember.create({
        data: {
          userId: member1.id,
          projectId: project.id,
          role: 'MEMBER',
        },
      });

      await expect(
        prisma.teamMember.create({
          data: {
            userId: member1.id, // Same user
            projectId: project.id, // Same project
            role: 'LEAD',
          },
        })
      ).rejects.toThrow();
    });

    it('should fetch project with team members', async () => {
      await prisma.teamMember.createMany({
        data: [
          {
            userId: member1.id,
            projectId: project.id,
            role: 'MEMBER',
            status: 'ACTIVE',
          },
          {
            userId: member2.id,
            projectId: project.id,
            role: 'LEAD',
            status: 'ACTIVE',
          },
        ],
      });

      const projectWithTeam = await prisma.specificationProject.findUnique({
        where: { id: project.id },
        include: {
          owner: {
            select: { id: true, name: true, email: true },
          },
          team: {
            include: {
              user: {
                select: { id: true, name: true, email: true },
              },
            },
          },
        },
      });

      expect(projectWithTeam?.team).toHaveLength(2);
      expect(projectWithTeam?.team[0].user.name).toBeDefined();
      expect(projectWithTeam?.owner.name).toBe('Project Owner');
    });
  });

  describe('Comment System', () => {
    let testUser: unknown;
    let testProject: unknown;
    let testDocument: unknown;

    beforeEach(async () => {
      const hashedPassword = await bcrypt.hash('testpassword', 12);
      testUser = await prisma.user.create({
        data: {
          email: `comment-user-${Date.now()}@example.com`,
          name: 'Comment User',
          password: hashedPassword,
          role: UserRole.DEVELOPER,
        },
      });

      testProject = await prisma.specificationProject.create({
        data: {
          name: 'Comment Test Project',
          ownerId: testUser.id,
        },
      });

      testDocument = await prisma.specificationDocument.create({
        data: {
          projectId: testProject.id,
          phase: SpecificationPhase.REQUIREMENTS,
          content: 'Test document content',
        },
      });
    });

    it('should create comment threads with comments', async () => {
      const thread = await prisma.commentThread.create({
        data: {
          documentId: testDocument.id,
          position: { line: 5, character: 10 },
          status: 'OPEN',
        },
      });

      const comment = await prisma.comment.create({
        data: {
          threadId: thread.id,
          authorId: testUser.id,
          content: 'This is a test comment',
        },
      });

      expect(thread.status).toBe('OPEN');
      expect(comment.content).toBe('This is a test comment');
    });

    it('should support comment reactions', async () => {
      const thread = await prisma.commentThread.create({
        data: {
          documentId: testDocument.id,
          position: { line: 1, character: 1 },
        },
      });

      const comment = await prisma.comment.create({
        data: {
          threadId: thread.id,
          authorId: testUser.id,
          content: 'Comment with reactions',
        },
      });

      const reaction = await prisma.reaction.create({
        data: {
          commentId: comment.id,
          userId: testUser.id,
          type: 'LIKE',
        },
      });

      expect(reaction.type).toBe('LIKE');
    });
  });

  describe('Learning System', () => {
    let testUser: unknown;

    beforeEach(async () => {
      const hashedPassword = await bcrypt.hash('testpassword', 12);
      testUser = await prisma.user.create({
        data: {
          email: `learner-${Date.now()}@example.com`,
          name: 'Learner User',
          password: hashedPassword,
          role: UserRole.STUDENT,
        },
      });
    });

    it('should create learning modules with progress tracking', async () => {
      const module = await prisma.learningModule.create({
        data: {
          title: 'Test Learning Module',
          description: 'A module for testing',
          phase: SpecificationPhase.REQUIREMENTS,
          difficulty: 'BEGINNER',
          prerequisites: [],
          content: { lessons: [] },
          exercises: { exercises: [] },
          estimatedDuration: 30,
          isPublished: true,
        },
      });

      const progress = await prisma.userProgress.create({
        data: {
          userId: testUser.id,
          moduleId: module.id,
          status: 'IN_PROGRESS',
          completedLessons: ['lesson1'],
        },
      });

      expect(module.title).toBe('Test Learning Module');
      expect(progress.status).toBe('IN_PROGRESS');
      expect(progress.completedLessons).toContain('lesson1');
    });
  });
});