// @ts-nocheck
import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
// @ts-nocheck
import { PrismaClient } from '@prisma/client';

// Types for collaboration
export interface CollaborationUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  color: string;
  joinedAt: Date;
  lastActivity: Date;
}

export interface UserSession {
  userId: string;
  documentId: string;
  socketId: string;
  joinedAt: Date;
  lastActivity: Date;
}

export interface DocumentChange {
  id: string;
  type: 'insert' | 'delete' | 'retain';
  position: number;
  content?: string;
  length?: number;
  author: string;
  timestamp: Date;
  documentId: string;
}

export interface CursorPosition {
  userId: string;
  documentId: string;
  line: number;
  character: number;
  timestamp: Date;
}

export interface JoinDocumentRequest {
  documentId: string;
  token: string;
}

export interface DocumentState {
  content: string;
  version: number;
  lastModified: Date;
}

// Operational Transformation for concurrent editing
export class OperationalTransform {
  static transform(op1: DocumentChange, op2: DocumentChange): [DocumentChange, DocumentChange] {
    if (op1.type === 'insert' && op2.type === 'insert') {
      if (op1.position <= op2.position) {
        return [op1, { ...op2, position: op2.position + (op1.content?.length || 0) }];
      } else {
        return [{ ...op1, position: op1.position + (op2.content?.length || 0) }, op2];
      }
    }

    if (op1.type === 'delete' && op2.type === 'delete') {
      if (op1.position <= op2.position) {
        return [
          op1,
          { ...op2, position: Math.max(op2.position - (op1.length || 0), op1.position) },
        ];
      } else {
        return [
          {
            ...op1,
            position: op1.position - Math.min(op2.length || 0, op1.position - op2.position),
          },
          op2,
        ];
      }
    }

    // Handle insert vs delete
    if (op1.type === 'insert' && op2.type === 'delete') {
      if (op1.position <= op2.position) {
        return [op1, { ...op2, position: op2.position + (op1.content?.length || 0) }];
      } else if (op1.position <= op2.position + (op2.length || 0)) {
        return [{ ...op1, position: op2.position }, op2];
      } else {
        return [{ ...op1, position: op1.position - (op2.length || 0) }, op2];
      }
    }

    if (op1.type === 'delete' && op2.type === 'insert') {
      if (op2.position <= op1.position) {
        return [{ ...op1, position: op1.position + (op2.content?.length || 0) }, op2];
      } else if (op2.position <= op1.position + (op1.length || 0)) {
        return [op1, { ...op2, position: op1.position }];
      } else {
        return [op1, { ...op2, position: op2.position - (op1.length || 0) }];
      }
    }

    return [op1, op2];
  }

  static apply(content: string, operation: DocumentChange): string {
    switch (operation.type) {
      case 'insert':
        return (
          content.slice(0, operation.position) +
          (operation.content || '') +
          content.slice(operation.position)
        );

      case 'delete':
        return (
          content.slice(0, operation.position) +
          content.slice(operation.position + (operation.length || 0))
        );

      default:
        return content;
    }
  }
}

// Conflict resolution strategies
export interface EditConflict {
  id: string;
  documentId: string;
  conflictingOperations: DocumentChange[];
  affectedRange: { start: number; end: number };
  users: string[];
  timestamp: Date;
}

export interface ConflictResolution {
  strategy: 'last-writer-wins' | 'merge' | 'manual';
  manualOperations?: DocumentChange[];
}

export class ConflictResolver {
  static detectConflicts(operations: DocumentChange[]): EditConflict[] {
    const conflicts: EditConflict[] = [];

    for (let i = 0; i < operations.length; i++) {
      for (let j = i + 1; j < operations.length; j++) {
        const op1 = operations[i];
        const op2 = operations[j];

        if (this.operationsOverlap(op1, op2)) {
          conflicts.push({
            id: `conflict_${Date.now()}_${Math.random()}`,
            documentId: op1.documentId,
            conflictingOperations: [op1, op2],
            affectedRange: this.getAffectedRange(op1, op2),
            users: [op1.author, op2.author],
            timestamp: new Date(),
          });
        }
      }
    }

    return conflicts;
  }

  private static operationsOverlap(op1: DocumentChange, op2: DocumentChange): boolean {
    const op1Start = op1.position;
    const op1End = op1.position + (op1.type === 'insert' ? (op1.content?.length || 0) : (op1.length || 0));
    const op2Start = op2.position;
    const op2End = op2.position + (op2.type === 'insert' ? (op2.content?.length || 0) : (op2.length || 0));

    // Check if ranges overlap
    return !(op1End <= op2Start || op2End <= op1Start);
  }

  private static getAffectedRange(op1: DocumentChange, op2: DocumentChange): { start: number; end: number } {
    const start = Math.min(op1.position, op2.position);
    const op1End = op1.position + (op1.type === 'insert' ? op1.content?.length || 0 : op1.length || 0);
    const op2End = op2.position + (op2.type === 'insert' ? op2.content?.length || 0 : op2.length || 0);
    const end = Math.max(op1End, op2End);

    return { start, end };
  }

  static async resolveConflict(
    conflict: EditConflict,
    resolution: ConflictResolution
  ): Promise<DocumentChange[]> {
    switch (resolution.strategy) {
      case 'last-writer-wins':
        return [
          conflict.conflictingOperations.sort(
            (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
          )[0],
        ];

      case 'merge':
        return this.mergeOperations(conflict.conflictingOperations);

      case 'manual':
        return resolution.manualOperations || [];

      default:
        throw new Error(`Unknown resolution strategy: ${resolution.strategy}`);
    }
  }

  private static mergeOperations(operations: DocumentChange[]): DocumentChange[] {
    // Simple merge strategy - combine insert operations, prioritize deletes
    const inserts = operations.filter(op => op.type === 'insert');
    const deletes = operations.filter(op => op.type === 'delete');

    if (deletes.length > 0) {
      return [deletes[0]]; // Prioritize delete operations
    }

    if (inserts.length > 1) {
      // Merge insert operations
      const merged: DocumentChange = {
        ...inserts[0],
        content: inserts.map(op => op.content || '').join(''),
      };
      return [merged];
    }

    return operations;
  }
}

// Main collaboration service
export class CollaborationService {
  private io: SocketIOServer;
  private redis: Redis;
  private prisma: PrismaClient;
  private userSessions: Map<string, UserSession> = new Map();
  private documentRooms: Map<string, Set<string>> = new Map();
  private userColors: string[] = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
  ];

  constructor(server: HTTPServer, redis: Redis, prisma: PrismaClient) {
    this.redis = redis;
    this.prisma = prisma;
    
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    // Use Redis adapter for horizontal scaling
    this.io.adapter(createAdapter(redis, redis.duplicate()));

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      // // console.log(`Socket connected: ${socket.id}`);

      socket.on('join-document', (_data: JoinDocumentRequest) => 
        this.handleJoinDocument(socket, data)
      );
      
      socket.on('document-change', (change: DocumentChange) => 
        this.handleDocumentChange(socket, change)
      );
      
      socket.on('cursor-position', (position: CursorPosition) => 
        this.handleCursorPosition(socket, position)
      );
      
      socket.on('disconnect', () => 
        this.handleDisconnect(socket)
      );
    });
  }

  private async handleJoinDocument(socket: Socket, _data: JoinDocumentRequest): Promise<void> {
    try {
      // Verify JWT token
      const decoded = jwt.verify(data.token, process.env.JWT_SECRET!) as any;
      const userId = decoded.userId;

      // Validate document access
      const hasAccess = await this.validateDocumentAccess(userId, data.documentId);
      if (!hasAccess) {
        socket.emit('error', { message: 'Access denied to document' });
        return;
      }

      // Get user information
      const _user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, avatar: true },
      });

      if (!user) {
        socket.emit('error', { message: 'User not found' });
        return;
      }

      // Join document room
      const roomName = `doc:${data.documentId}`;
      await socket.join(roomName);

      // Create user session
      const session: UserSession = {
        userId,
        documentId: data.documentId,
        socketId: socket.id,
        joinedAt: new Date(),
        lastActivity: new Date(),
      };

      this.userSessions.set(socket.id, session);

      // Add to document room tracking
      if (!this.documentRooms.has(data.documentId)) {
        this.documentRooms.set(data.documentId, new Set());
      }
      this.documentRooms.get(data.documentId)!.add(socket.id);

      // Create collaboration user
      const collaborationUser: CollaborationUser = {
        ...user,
        color: this.assignUserColor(userId),
        joinedAt: session.joinedAt,
        lastActivity: session.lastActivity,
      };

      // Notify other users
      socket.to(roomName).emit('user-joined', collaborationUser);

      // Send current document state and active users
      const documentState = await this.getDocumentState(data.documentId);
      const activeUsers = await this.getActiveUsers(data.documentId);

      socket.emit('document-joined', {
        documentState,
        activeUsers,
        user: collaborationUser,
      });

      // // console.log(`User ${user.name} joined document ${data.documentId}`);
    } catch (error) {
      console.error('Error joining document:', error);
      socket.emit('error', { message: 'Failed to join document' });
    }
  }

  private async handleDocumentChange(socket: Socket, change: DocumentChange): Promise<void> {
    try {
      const session = this.userSessions.get(socket.id);
      if (!session) {
        socket.emit('error', { message: 'Session not found' });
        return;
      }

      // Update last activity
      session.lastActivity = new Date();

      // Apply operational transformation
      const transformedChange = await this.applyOperationalTransform(change);

      // Update document in database
      await this.updateDocument(session.documentId, transformedChange);

      // Broadcast change to other users in the room
      const roomName = `doc:${session.documentId}`;
      socket.to(roomName).emit('document-change', transformedChange);

      // Store change in Redis for conflict resolution
      await this.storeDocumentChange(transformedChange);

    } catch (error) {
      console.error('Error handling document change:', error);
      socket.emit('error', { message: 'Failed to apply document change' });
    }
  }

  private async handleCursorPosition(socket: Socket, position: CursorPosition): Promise<void> {
    const session = this.userSessions.get(socket.id);
    if (!session) return;

    // Update last activity
    session.lastActivity = new Date();

    // Broadcast cursor position to other users
    const roomName = `doc:${session.documentId}`;
    socket.to(roomName).emit('cursor-position', {
      ...position,
      userId: session.userId,
      timestamp: new Date(),
    });
  }

  private async handleDisconnect(socket: Socket): Promise<void> {
    const session = this.userSessions.get(socket.id);
    if (!session) return;

    // Remove from tracking
    this.userSessions.delete(socket.id);
    
    const documentRoom = this.documentRooms.get(session.documentId);
    if (documentRoom) {
      documentRoom.delete(socket.id);
      if (documentRoom.size === 0) {
        this.documentRooms.delete(session.documentId);
      }
    }

    // Notify other users
    const roomName = `doc:${session.documentId}`;
    socket.to(roomName).emit('user-left', session.userId);

    // // console.log(`User ${session.userId} left document ${session.documentId}`);
  }

  private async validateDocumentAccess(userId: string, documentId: string): Promise<boolean> {
    try {
      const _document = await this.prisma.specificationDocument.findFirst({
        where: {
          id: documentId,
          project: {
            OR: [
              { ownerId: userId },
              { team: { some: { userId, status: 'ACTIVE' } } },
            ],
          },
        },
      });

      return !!document;
    } catch (error) {
      console.error('Error validating document access:', error);
      return false;
    }
  }

  private async getDocumentState(documentId: string): Promise<DocumentState> {
    const _document = await this.prisma.specificationDocument.findUnique({
      where: { id: documentId },
      select: { content: true, version: true, updatedAt: true },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    return {
      content: document.content,
      version: document.version,
      lastModified: document.updatedAt,
    };
  }

  private async getActiveUsers(documentId: string): Promise<CollaborationUser[]> {
    const socketIds = this.documentRooms.get(documentId);
    if (!socketIds) return [];

    const users: CollaborationUser[] = [];
    
    for (const socketId of socketIds) {
      const session = this.userSessions.get(socketId);
      if (session) {
        const _user = await this.prisma.user.findUnique({
          where: { id: session.userId },
          select: { id: true, name: true, email: true, avatar: true },
        });

        if (user) {
          users.push({
            ...user,
            color: this.assignUserColor(session.userId),
            joinedAt: session.joinedAt,
            lastActivity: session.lastActivity,
          });
        }
      }
    }

    return users;
  }

  private assignUserColor(userId: string): string {
    // Simple hash-based color assignment
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash + userId.charCodeAt(i)) & 0xffffffff;
    }
    return this.userColors[Math.abs(hash) % this.userColors.length];
  }

  private async applyOperationalTransform(change: DocumentChange): Promise<DocumentChange> {
    // Get recent changes from Redis for transformation
    const recentChanges = await this.getRecentDocumentChanges(change.documentId);
    
    let transformedChange = change;
    
    // Apply operational transformation against recent changes
    for (const recentChange of recentChanges) {
      if (recentChange.timestamp > change.timestamp) {
        const [transformed] = OperationalTransform.transform(transformedChange, recentChange);
        transformedChange = transformed;
      }
    }

    return transformedChange;
  }

  private async updateDocument(documentId: string, change: DocumentChange): Promise<void> {
    const _document = await this.prisma.specificationDocument.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    const newContent = OperationalTransform.apply(document.content, change);

    await this.prisma.specificationDocument.update({
      where: { id: documentId },
      data: {
        content: newContent,
        version: { increment: 1 },
        updatedAt: new Date(),
      },
    });
  }

  private async storeDocumentChange(change: DocumentChange): Promise<void> {
    const key = `doc_changes:${change.documentId}`;
    await this.redis.lpush(key, JSON.stringify(change));
    await this.redis.ltrim(key, 0, 99); // Keep last 100 changes
    await this.redis.expire(key, 3600); // Expire after 1 hour
  }

  private async getRecentDocumentChanges(documentId: string): Promise<DocumentChange[]> {
    const key = `doc_changes:${documentId}`;
    const changes = await this.redis.lrange(key, 0, 49); // Get last 50 changes
    return changes.map(change => JSON.parse(change));
  }

  // Public method to get collaboration statistics
  public getCollaborationStats(): {
    activeDocuments: number;
    totalUsers: number;
    documentUsers: Record<string, number>;
  } {
    const documentUsers: Record<string, number> = {};
    
    for (const [documentId, socketIds] of this.documentRooms.entries()) {
      documentUsers[documentId] = socketIds.size;
    }

    return {
      activeDocuments: this.documentRooms.size,
      totalUsers: this.userSessions.size,
      documentUsers,
    };
  }
}