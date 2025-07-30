import {
  PrismaClient,
  UserRole,
  SpecificationPhase,
  DocumentStatus,
  ProjectStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();
async function main() {
  console.log('🌱 Seeding database...');
  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 12);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@codementor-ai.com' },
    update: {},
    create: {
      email: 'admin@codementor-ai.com',
      name: 'Admin User',
      role: UserRole.ADMIN,
      password: adminPassword,
      isVerified: true,
    },
  });
  // Create developer user
  const devPassword = await bcrypt.hash('dev123', 12);
  const devUser = await prisma.user.upsert({
    where: { email: 'developer@codementor-ai.com' },
    update: {},
    create: {
      email: 'developer@codementor-ai.com',
      name: 'Developer User',
      role: UserRole.DEVELOPER,
      password: devPassword,
      isVerified: true,
    },
  });
  // Create team lead user
  const teamLeadPassword = await bcrypt.hash('lead123', 12);
  const teamLeadUser = await prisma.user.upsert({
    where: { email: 'teamlead@codementor-ai.com' },
    update: {},
    create: {
      email: 'teamlead@codementor-ai.com',
      name: 'Team Lead User',
      role: UserRole.TEAM_LEAD,
      password: teamLeadPassword,
      isVerified: true,
    },
  });
  // Create sample learning modules
  const requirementsModule = await prisma.learningModule.upsert({
    where: { id: 'requirements-basics' },
    update: {},
    create: {
      id: 'requirements-basics',
      title: 'Requirements Engineering Basics',
      description:
        'Learn the fundamentals of writing clear, testable requirements using EARS format and user stories.',
      phase: SpecificationPhase.REQUIREMENTS,
      difficulty: 'BEGINNER',
      prerequisites: [],
      content: {
        lessons: [
          {
            id: 'intro-requirements',
            title: 'Introduction to Requirements',
            content: 'Understanding what makes a good requirement...',
            duration: 15,
          },
          {
            id: 'ears-format',
            title: 'EARS Format',
            content: 'Learn the Easy Approach to Requirements Syntax...',
            duration: 20,
          },
          {
            id: 'user-stories',
            title: 'Writing User Stories',
            content: 'As a user, I want... format and best practices...',
            duration: 25,
          },
        ],
      },
      exercises: {
        exercises: [
          {
            id: 'write-ears-requirement',
            title: 'Write an EARS Requirement',
            description: 'Convert this plain text requirement into EARS format',
            type: 'text-input',
          },
        ],
      },
      estimatedDuration: 60,
      isPublished: true,
    },
  });
  const designModule = await prisma.learningModule.upsert({
    where: { id: 'design-fundamentals' },
    update: {},
    create: {
      id: 'design-fundamentals',
      title: 'Design Document Fundamentals',
      description:
        'Learn to create comprehensive technical design documents that bridge requirements and implementation.',
      phase: SpecificationPhase.DESIGN,
      difficulty: 'INTERMEDIATE',
      prerequisites: ['requirements-basics'],
      content: {
        lessons: [
          {
            id: 'architecture-overview',
            title: 'Architecture Overview',
            content: 'Creating high-level system architecture...',
            duration: 30,
          },
          {
            id: 'component-design',
            title: 'Component Design',
            content: 'Designing individual components and interfaces...',
            duration: 25,
          },
        ],
      },
      exercises: {
        exercises: [
          {
            id: 'create-architecture-diagram',
            title: 'Create Architecture Diagram',
            description: 'Design a system architecture for the given requirements',
            type: 'diagram',
          },
        ],
      },
      estimatedDuration: 90,
      isPublished: true,
    },
  });
  // Create sample projects
  const sampleProject = await prisma.specificationProject.create({
    data: {
      name: 'E-commerce Platform',
      description:
        'A comprehensive e-commerce platform with user management, product catalog, and order processing.',
      ownerId: adminUser.id,
      currentPhase: SpecificationPhase.REQUIREMENTS,
      status: ProjectStatus.ACTIVE,
      documents: {
        create: [
          {
            phase: SpecificationPhase.REQUIREMENTS,
            content: `# Requirements Document

## Introduction

This document outlines the requirements for a modern e-commerce platform that enables users to browse products, manage their cart, and complete purchases securely.

## Requirements

### Requirement 1: User Authentication

**User Story:** As a customer, I want to create an account and log in securely, so that I can save my preferences and track my orders.

#### Acceptance Criteria

1. WHEN a user registers THEN the system SHALL create a secure account with email verification
2. WHEN a user logs in THEN the system SHALL authenticate credentials and establish a secure session
3. IF login credentials are invalid THEN the system SHALL display an appropriate error message
4. WHEN a user requests password reset THEN the system SHALL send a secure reset link to their email

### Requirement 2: Product Catalog

**User Story:** As a customer, I want to browse and search for products, so that I can find items I want to purchase.

#### Acceptance Criteria

1. WHEN a user visits the catalog THEN the system SHALL display products with images, names, and prices
2. WHEN a user searches for products THEN the system SHALL return relevant results based on name and description
3. WHEN a user filters products THEN the system SHALL show only products matching the selected criteria
4. IF no products match the search THEN the system SHALL display a helpful "no results" message`,
            status: DocumentStatus.APPROVED,
          },
          {
            phase: SpecificationPhase.DESIGN,
            content: `# Design Document

## Overview

The e-commerce platform will be built using a microservices architecture with React frontend, Node.js backend services, and PostgreSQL database.

## Architecture

### High-Level Components

- **Frontend**: React SPA with TypeScript
- **API Gateway**: Express.js with authentication middleware
- **User Service**: Handles authentication and user management
- **Product Service**: Manages product catalog and search
- **Order Service**: Processes orders and payments
- **Database**: PostgreSQL with Redis caching

## Data Models

### User Model
\`\`\`typescript
interface User {
  id: string;
  email: string;
  name: string;
  hashedPassword: string;
  isVerified: boolean;
  createdAt: Date;
}
\`\`\`

### Product Model
\`\`\`typescript
interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string;
  inStock: boolean;
}
\`\`\``,
            status: DocumentStatus.DRAFT,
          },
          {
            phase: SpecificationPhase.TASKS,
            content: `# Implementation Plan

- [ ] 1. Set up project structure and development environment
  - Initialize React frontend with TypeScript
  - Set up Node.js backend with Express
  - Configure PostgreSQL database with Prisma
  - _Requirements: System setup_

- [ ] 2. Implement user authentication system
  - [ ] 2.1 Create user registration endpoint
    - Implement password hashing with bcrypt
    - Add email verification functionality
    - Write unit tests for registration logic
    - _Requirements: 1.1, 1.2_

  - [ ] 2.2 Create login and session management
    - Implement JWT-based authentication
    - Add password reset functionality
    - Create protected route middleware
    - _Requirements: 1.3, 1.4_

- [ ] 3. Build product catalog system
  - [ ] 3.1 Create product data models and API
    - Design product database schema
    - Implement CRUD operations for products
    - Add product search and filtering
    - _Requirements: 2.1, 2.2, 2.3_`,
            status: DocumentStatus.DRAFT,
          },
        ],
      },
      team: {
        create: [
          {
            userId: devUser.id,
            role: 'MEMBER',
            status: 'ACTIVE',
          },
          {
            userId: teamLeadUser.id,
            role: 'LEAD',
            status: 'ACTIVE',
          },
        ],
      },
    },
  });
  // Create another sample project
  const blogProject = await prisma.specificationProject.create({
    data: {
      name: 'Personal Blog Platform',
      description:
        'A simple blog platform for creating and sharing articles with commenting system.',
      ownerId: devUser.id,
      currentPhase: SpecificationPhase.REQUIREMENTS,
      status: ProjectStatus.ACTIVE,
      documents: {
        create: [
          {
            phase: SpecificationPhase.REQUIREMENTS,
            content: `# Blog Platform Requirements

## Introduction

A personal blog platform that allows users to create, edit, and publish articles with a commenting system.

## Requirements

### Requirement 1: Article Management

**User Story:** As a blogger, I want to create and manage my articles, so that I can share my thoughts with readers.

#### Acceptance Criteria

1. WHEN a blogger creates an article THEN the system SHALL save it as a draft
2. WHEN a blogger publishes an article THEN the system SHALL make it visible to readers
3. WHEN a blogger edits an article THEN the system SHALL preserve the edit history
4. IF an article is deleted THEN the system SHALL archive it instead of permanent deletion`,
            status: DocumentStatus.DRAFT,
          },
          {
            phase: SpecificationPhase.DESIGN,
            content: `# Blog Platform Design

## Overview

Simple blog platform with clean architecture and focus on content creation.

## Components

- Article editor with markdown support
- Comment system with moderation
- User authentication and profiles
- SEO-friendly URLs and metadata`,
            status: DocumentStatus.DRAFT,
          },
          {
            phase: SpecificationPhase.TASKS,
            content: `# Blog Implementation Tasks

- [ ] 1. Set up basic project structure
- [ ] 2. Implement article CRUD operations
- [ ] 3. Add markdown editor
- [ ] 4. Create commenting system`,
            status: DocumentStatus.DRAFT,
          },
        ],
      },
    },
  });
  // Create user progress records
  await prisma.userProgress.create({
    data: {
      userId: devUser.id,
      moduleId: requirementsModule.id,
      status: 'IN_PROGRESS',
      completedLessons: ['intro-requirements'],
      lastAccessed: new Date(),
    },
  });
  console.log('✅ Database seeded successfully');
  console.log(`👤 Admin user: admin@codementor-ai.com / admin123`);
  console.log(`👤 Developer user: developer@codementor-ai.com / dev123`);
  console.log(`👤 Team Lead user: teamlead@codementor-ai.com / lead123`);
  console.log(`📁 Created ${2} sample projects`);
  console.log(`📚 Created ${2} learning modules`);
}
main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
