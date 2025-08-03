// @ts-nocheck
export enum SpecificationPhase {
  REQUIREMENTS = 'REQUIREMENTS',
  DESIGN = 'DESIGN',
  TASKS = 'TASKS',
  IMPLEMENTATION = 'IMPLEMENTATION',
}

export enum ProjectStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED',
  SUSPENDED = 'SUSPENDED',
}

export enum DocumentStatus {
  DRAFT = 'DRAFT',
  REVIEW = 'REVIEW',
  APPROVED = 'APPROVED',
  ARCHIVED = 'ARCHIVED',
}

export enum TeamMemberRole {
  MEMBER = 'MEMBER',
  LEAD = 'LEAD',
  ADMIN = 'ADMIN',
}

export enum TeamMemberStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  PENDING = 'PENDING',
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface TeamMember {
  id: string;
  role: TeamMemberRole;
  status: TeamMemberStatus;
  joinedAt: string;
  user: User;
}

export interface SpecificationDocument {
  id: string;
  phase: SpecificationPhase;
  status: DocumentStatus;
  version: number;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  currentPhase: SpecificationPhase;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  owner: User;
  team: TeamMember[];
  documents: SpecificationDocument[];
  _count: {
    documents: number;
    team: number;
  };
}

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
  projects: Project[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface AddTeamMemberRequest {
  userId: string;
  role: TeamMemberRole;
}

export interface ProjectAnalytics {
  documentCount: number;
  commentThreadCount: number;
  commentCount: number;
  activeTeamMembers: number;
  averageQualityScore?: number;
  lastActivity?: string;
}