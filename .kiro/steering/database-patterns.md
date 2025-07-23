# Database Patterns and Standards

## Prisma Schema Design

### Core Domain Models

```prisma
// User and authentication models
model User {
  id          String   @id @default(cuid())
  email       String   @unique
  name        String
  avatar      String?
  role        UserRole @default(DEVELOPER)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relationships
  ownedProjects     SpecificationProject[] @relation("ProjectOwner")
  teamMemberships   TeamMember[]
  comments          Comment[]
  auditLogs         AuditLog[]
  userProgress      UserProgress[]

  @@map("users")
}

model SpecificationProject {
  id            String              @id @default(cuid())
  name          String
  description   String?
  currentPhase  SpecificationPhase  @default(REQUIREMENTS)
  status        ProjectStatus       @default(ACTIVE)
  settings      Json                @default("{}")
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt

  // Relationships
  owner         User                @relation("ProjectOwner", fields: [ownerId], references: [id])
  ownerId       String
  team          TeamMember[]
  documents     SpecificationDocument[]
  analytics     ProjectAnalytics[]

  @@map("specification_projects")
}

model SpecificationDocument {
  id            String              @id @default(cuid())
  phase         SpecificationPhase
  content       String              @db.Text
  version       Int                 @default(1)
  status        DocumentStatus      @default(DRAFT)
  metadata      Json                @default("{}")
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt

  // Relationships
  project       SpecificationProject @relation(fields: [projectId], references: [id], onDelete: Cascade)
  projectId     String
  comments      CommentThread[]
  reviews       AIReview[]
  versions      DocumentVersion[]

  @@unique([projectId, phase])
  @@map("specification_documents")
}

// Enums
enum UserRole {
  STUDENT
  DEVELOPER
  TEAM_LEAD
  ADMIN
}

enum SpecificationPhase {
  REQUIREMENTS
  DESIGN
  TASKS
  IMPLEMENTATION
}

enum DocumentStatus {
  DRAFT
  REVIEW
  APPROVED
  ARCHIVED
}

enum ProjectStatus {
  ACTIVE
  COMPLETED
  ARCHIVED
  SUSPENDED
}
```

### Collaboration and Comments

```prisma
model CommentThread {
  id          String    @id @default(cuid())
  position    Json      // { line: number, character: number }
  status      CommentStatus @default(OPEN)
  createdAt   DateTime  @default(now())
  resolvedAt  DateTime?
  resolvedBy  String?

  // Relationships
  document    SpecificationDocument @relation(fields: [documentId], references: [id], onDelete: Cascade)
  documentId  String
  comments    Comment[]

  @@map("comment_threads")
}

model Comment {
  id          String    @id @default(cuid())
  content     String    @db.Text
  createdAt   DateTime  @default(now())
  editedAt    DateTime?

  // Relationships
  thread      CommentThread @relation(fields: [threadId], references: [id], onDelete: Cascade)
  threadId    String
  author      User      @relation(fields: [authorId], references: [id])
  authorId    String
  reactions   Reaction[]

  @@map("comments")
}

model Reaction {
  id        String      @id @default(cuid())
  type      ReactionType
  createdAt DateTime    @default(now())

  // Relationships
  comment   Comment     @relation(fields: [commentId], references: [id], onDelete: Cascade)
  commentId String
  user      User        @relation(fields: [userId], references: [id])
  userId    String

  @@unique([commentId, userId, type])
  @@map("reactions")
}

enum CommentStatus {
  OPEN
  RESOLVED
}

enum ReactionType {
  LIKE
  DISLIKE
  HELPFUL
  CONFUSED
}
```

### AI Integration Models

```prisma
model AIReview {
  id              String    @id @default(cuid())
  overallScore    Float
  suggestions     Json      // AISuggestion[]
  completeness    Json      // CompletenessResult
  qualityMetrics  Json      // QualityMetrics
  createdAt       DateTime  @default(now())

  // Relationships
  document        SpecificationDocument @relation(fields: [documentId], references: [id], onDelete: Cascade)
  documentId      String
  appliedSuggestions String[] // Array of suggestion IDs

  @@map("ai_reviews")
}

model AIUsage {
  id          String    @id @default(cuid())
  userId      String
  action      String    // 'review', 'suggestion', 'validation'
  tokensUsed  Int
  cost        Float
  createdAt   DateTime  @default(now())

  // Relationships
  user        User      @relation(fields: [userId], references: [id])

  @@map("ai_usage")
}
```

### Learning and Progress Tracking

```prisma
model LearningModule {
  id              String          @id @default(cuid())
  title           String
  description     String          @db.Text
  phase           SpecificationPhase?
  difficulty      DifficultyLevel
  prerequisites   String[]        // Array of module IDs
  content         Json            // LessonContent[]
  exercises       Json            // Exercise[]
  estimatedDuration Int           // in minutes
  isPublished     Boolean         @default(false)
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  // Relationships
  userProgress    UserProgress[]

  @@map("learning_modules")
}

model UserProgress {
  id                String              @id @default(cuid())
  status            ProgressStatus      @default(NOT_STARTED)
  completedLessons  String[]            // Array of lesson IDs
  exerciseResults   Json                @default("[]") // ExerciseResult[]
  skillAssessments  Json                @default("[]") // SkillAssessment[]
  lastAccessed      DateTime?
  completedAt       DateTime?

  // Relationships
  user              User                @relation(fields: [userId], references: [id])
  userId            String
  module            LearningModule      @relation(fields: [moduleId], references: [id])
  moduleId          String

  @@unique([userId, moduleId])
  @@map("user_progress")
}

enum DifficultyLevel {
  BEGINNER
  INTERMEDIATE
  ADVANCED
  EXPERT
}

enum ProgressStatus {
  NOT_STARTED
  IN_PROGRESS
  COMPLETED
  SKIPPED
}
```

## Query Patterns and Optimization

### Efficient Data Fetching

```typescript
// Repository pattern for data access
class SpecificationRepository {
  constructor(private prisma: PrismaClient) {}

  // Optimized project fetching with related data
  async getProjectWithDocuments(
    projectId: string,
    userId: string
  ): Promise<ProjectWithDocuments | null> {
    return await this.prisma.specificationProject.findFirst({
      where: {
        id: projectId,
        OR: [{ ownerId: userId }, { team: { some: { userId, status: 'ACTIVE' } } }],
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        team: {
          where: { status: 'ACTIVE' },
          include: {
            user: {
              select: { id: true, name: true, email: true, avatar: true },
            },
          },
        },
        documents: {
          orderBy: { phase: 'asc' },
          include: {
            comments: {
              where: { status: 'OPEN' },
              include: {
                comments: {
                  take: 1,
                  orderBy: { createdAt: 'desc' },
                  include: {
                    author: {
                      select: { id: true, name: true, avatar: true },
                    },
                  },
                },
              },
            },
            reviews: {
              take: 1,
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });
  }

  // Paginated project listing with search
  async getProjectsForUser(
    userId: string,
    options: {
      search?: string;
      status?: ProjectStatus;
      page: number;
      limit: number;
    }
  ): Promise<PaginatedProjects> {
    const { search, status, page, limit } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.SpecificationProjectWhereInput = {
      OR: [{ ownerId: userId }, { team: { some: { userId, status: 'ACTIVE' } } }],
      ...(status && { status }),
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
            select: { id: true, name: true, avatar: true },
          },
          team: {
            where: { status: 'ACTIVE' },
            select: {
              user: {
                select: { id: true, name: true, avatar: true },
              },
            },
          },
          _count: {
            select: {
              documents: true,
              comments: true,
            },
          },
        },
      }),
      this.prisma.specificationProject.count({ where }),
    ]);

    return {
      projects,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // Bulk operations for analytics
  async getProjectAnalytics(projectIds: string[]): Promise<ProjectAnalytics[]> {
    return await this.prisma.$queryRaw`
      SELECT 
        p.id as "projectId",
        p.name,
        p.current_phase as "currentPhase",
        COUNT(DISTINCT d.id) as "documentCount",
        COUNT(DISTINCT c.id) as "commentCount",
        COUNT(DISTINCT tm.id) as "teamMemberCount",
        AVG(ar.overall_score) as "averageQualityScore",
        MAX(d.updated_at) as "lastActivity"
      FROM specification_projects p
      LEFT JOIN specification_documents d ON p.id = d.project_id
      LEFT JOIN comment_threads ct ON d.id = ct.document_id
      LEFT JOIN comments c ON ct.id = c.thread_id
      LEFT JOIN team_members tm ON p.id = tm.project_id AND tm.status = 'ACTIVE'
      LEFT JOIN ai_reviews ar ON d.id = ar.document_id
      WHERE p.id = ANY(${projectIds})
      GROUP BY p.id, p.name, p.current_phase
    `;
  }
}
```

### Database Transactions

```typescript
// Transaction patterns for complex operations
class SpecificationService {
  constructor(private prisma: PrismaClient) {}

  async createProjectWithInitialDocuments(
    data: CreateProjectRequest,
    userId: string
  ): Promise<SpecificationProject> {
    return await this.prisma.$transaction(async tx => {
      // Create project
      const project = await tx.specificationProject.create({
        data: {
          name: data.name,
          description: data.description,
          ownerId: userId,
          currentPhase: 'REQUIREMENTS',
        },
      });

      // Create initial documents for each phase
      const phases: SpecificationPhase[] = ['REQUIREMENTS', 'DESIGN', 'TASKS'];
      const documents = await Promise.all(
        phases.map(phase =>
          tx.specificationDocument.create({
            data: {
              projectId: project.id,
              phase,
              content: this.getInitialContent(phase),
              status: phase === 'REQUIREMENTS' ? 'DRAFT' : 'DRAFT',
            },
          })
        )
      );

      // Add team members if specified
      if (data.teamMemberIds?.length) {
        await tx.teamMember.createMany({
          data: data.teamMemberIds.map(memberId => ({
            projectId: project.id,
            userId: memberId,
            role: 'MEMBER',
            status: 'ACTIVE',
          })),
        });
      }

      // Log project creation
      await tx.auditLog.create({
        data: {
          userId,
          action: 'project_created',
          resource: 'project',
          resourceId: project.id,
          details: { projectName: project.name },
        },
      });

      return project;
    });
  }

  async transitionPhase(
    projectId: string,
    targetPhase: SpecificationPhase,
    userId: string
  ): Promise<void> {
    await this.prisma.$transaction(async tx => {
      // Validate current phase completion
      const project = await tx.specificationProject.findUnique({
        where: { id: projectId },
        include: { documents: true },
      });

      if (!project) {
        throw new Error('Project not found');
      }

      // Check if user has permission
      const hasPermission = await this.checkPhaseTransitionPermission(tx, projectId, userId);

      if (!hasPermission) {
        throw new Error('Insufficient permissions for phase transition');
      }

      // Update project phase
      await tx.specificationProject.update({
        where: { id: projectId },
        data: {
          currentPhase: targetPhase,
          updatedAt: new Date(),
        },
      });

      // Update document statuses
      await tx.specificationDocument.updateMany({
        where: {
          projectId,
          phase: targetPhase,
        },
        data: { status: 'DRAFT' },
      });

      // Log phase transition
      await tx.auditLog.create({
        data: {
          userId,
          action: 'phase_transition',
          resource: 'project',
          resourceId: projectId,
          details: {
            fromPhase: project.currentPhase,
            toPhase: targetPhase,
          },
        },
      });
    });
  }
}
```

## Performance Optimization

### Database Indexing Strategy

```sql
-- Core indexes for performance
CREATE INDEX CONCURRENTLY idx_projects_owner_status ON specification_projects(owner_id, status);
CREATE INDEX CONCURRENTLY idx_projects_updated_at ON specification_projects(updated_at DESC);
CREATE INDEX CONCURRENTLY idx_documents_project_phase ON specification_documents(project_id, phase);
CREATE INDEX CONCURRENTLY idx_comments_thread_created ON comments(thread_id, created_at DESC);
CREATE INDEX CONCURRENTLY idx_team_members_user_status ON team_members(user_id, status);

-- Full-text search indexes
CREATE INDEX CONCURRENTLY idx_projects_search ON specification_projects
USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

CREATE INDEX CONCURRENTLY idx_documents_content_search ON specification_documents
USING gin(to_tsvector('english', content));

-- Composite indexes for common queries
CREATE INDEX CONCURRENTLY idx_user_progress_user_status ON user_progress(user_id, status);
CREATE INDEX CONCURRENTLY idx_ai_reviews_document_created ON ai_reviews(document_id, created_at DESC);
```

### Connection Pooling and Caching

```typescript
// Prisma client configuration with connection pooling
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn'] : ['warn', 'error'],
});

// Redis caching layer
class CachedSpecificationRepository extends SpecificationRepository {
  constructor(
    prisma: PrismaClient,
    private redis: Redis,
    private cacheTTL: number = 300 // 5 minutes
  ) {
    super(prisma);
  }

  async getProjectWithDocuments(
    projectId: string,
    userId: string
  ): Promise<ProjectWithDocuments | null> {
    const cacheKey = `project:${projectId}:user:${userId}`;

    // Try cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fetch from database
    const project = await super.getProjectWithDocuments(projectId, userId);

    // Cache result
    if (project) {
      await this.redis.setex(cacheKey, this.cacheTTL, JSON.stringify(project));
    }

    return project;
  }

  async invalidateProjectCache(projectId: string): Promise<void> {
    const pattern = `project:${projectId}:*`;
    const keys = await this.redis.keys(pattern);

    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
```

## Data Migration and Seeding

```typescript
// Database seeding for development
async function seedDatabase() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@codementor-ai.com' },
    update: {},
    create: {
      email: 'admin@codementor-ai.com',
      name: 'Admin User',
      role: 'ADMIN',
    },
  });

  // Create sample learning modules
  const modules = await Promise.all([
    prisma.learningModule.upsert({
      where: { id: 'requirements-basics' },
      update: {},
      create: {
        id: 'requirements-basics',
        title: 'Requirements Engineering Basics',
        description: 'Learn the fundamentals of writing clear, testable requirements',
        phase: 'REQUIREMENTS',
        difficulty: 'BEGINNER',
        prerequisites: [],
        content: sampleLearningContent.requirements,
        exercises: sampleExercises.requirements,
        estimatedDuration: 45,
        isPublished: true,
      },
    }),
    // Add more modules...
  ]);

  // Create sample projects
  const sampleProject = await prisma.specificationProject.create({
    data: {
      name: 'Sample E-commerce Platform',
      description: 'A comprehensive e-commerce platform specification',
      ownerId: adminUser.id,
      currentPhase: 'REQUIREMENTS',
      documents: {
        create: [
          {
            phase: 'REQUIREMENTS',
            content: sampleContent.requirements,
            status: 'APPROVED',
          },
          {
            phase: 'DESIGN',
            content: sampleContent.design,
            status: 'DRAFT',
          },
          {
            phase: 'TASKS',
            content: sampleContent.tasks,
            status: 'DRAFT',
          },
        ],
      },
    },
  });

  console.log('✅ Database seeded successfully');
}
```
