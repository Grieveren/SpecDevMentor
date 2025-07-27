import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { Client as SocketIOClient } from 'socket.io-client';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import {
  CollaborationService,
  OperationalTransform,
  ConflictResolver,
  DocumentChange,
  EditConflict,
  ConflictResolution,
} from '../services/collaboration.service.js';

// Mock dependencies
vi.mock('ioredis');
vi.mock('jsonwebtoken');
vi.mock('@prisma/client');
vi.mock('@socket.io/redis-adapter', () => ({
  createAdapter: vi.fn(() => vi.fn()),
}));

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
  },
  specificationDocument: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
};

const mockRedis = {
  lpush: vi.fn(),
  ltrim: vi.fn(),
  expire: vi.fn(),
  lrange: vi.fn(),
  duplicate: vi.fn(() => mockRedis),
  psubscribe: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  publish: vi.fn(),
} as any;

describe('OperationalTransform', () => {
  describe('transform', () => {
    it('should handle insert-insert operations correctly', () => {
      const op1: DocumentChange = {
        id: '1',
        type: 'insert',
        position: 5,
        content: 'hello',
        author: 'user1',
        timestamp: new Date(),
        documentId: 'doc1',
      };

      const op2: DocumentChange = {
        id: '2',
        type: 'insert',
        position: 10,
        content: 'world',
        author: 'user2',
        timestamp: new Date(),
        documentId: 'doc1',
      };

      const [transformed1, transformed2] = OperationalTransform.transform(op1, op2);

      expect(transformed1).toEqual(op1);
      expect(transformed2.position).toBe(15); // 10 + 5 (length of op1.content)
    });

    it('should handle delete-delete operations correctly', () => {
      const op1: DocumentChange = {
        id: '1',
        type: 'delete',
        position: 5,
        length: 3,
        author: 'user1',
        timestamp: new Date(),
        documentId: 'doc1',
      };

      const op2: DocumentChange = {
        id: '2',
        type: 'delete',
        position: 10,
        length: 2,
        author: 'user2',
        timestamp: new Date(),
        documentId: 'doc1',
      };

      const [transformed1, transformed2] = OperationalTransform.transform(op1, op2);

      expect(transformed1).toEqual(op1);
      expect(transformed2.position).toBe(7); // 10 - 3 (length of op1)
    });

    it('should handle insert-delete operations correctly', () => {
      const insertOp: DocumentChange = {
        id: '1',
        type: 'insert',
        position: 5,
        content: 'hello',
        author: 'user1',
        timestamp: new Date(),
        documentId: 'doc1',
      };

      const deleteOp: DocumentChange = {
        id: '2',
        type: 'delete',
        position: 10,
        length: 3,
        author: 'user2',
        timestamp: new Date(),
        documentId: 'doc1',
      };

      const [transformed1, transformed2] = OperationalTransform.transform(insertOp, deleteOp);

      expect(transformed1).toEqual(insertOp);
      expect(transformed2.position).toBe(15); // 10 + 5 (length of insert)
    });
  });

  describe('apply', () => {
    it('should apply insert operation correctly', () => {
      const content = 'Hello world';
      const operation: DocumentChange = {
        id: '1',
        type: 'insert',
        position: 5,
        content: ' beautiful',
        author: 'user1',
        timestamp: new Date(),
        documentId: 'doc1',
      };

      const result = OperationalTransform.apply(content, operation);
      expect(result).toBe('Hello beautiful world');
    });

    it('should apply delete operation correctly', () => {
      const content = 'Hello beautiful world';
      const operation: DocumentChange = {
        id: '1',
        type: 'delete',
        position: 5,
        length: 10, // ' beautiful'
        author: 'user1',
        timestamp: new Date(),
        documentId: 'doc1',
      };

      const result = OperationalTransform.apply(content, operation);
      expect(result).toBe('Hello world');
    });

    it('should handle retain operation (no change)', () => {
      const content = 'Hello world';
      const operation: DocumentChange = {
        id: '1',
        type: 'retain',
        position: 5,
        author: 'user1',
        timestamp: new Date(),
        documentId: 'doc1',
      };

      const result = OperationalTransform.apply(content, operation);
      expect(result).toBe(content);
    });
  });
});

describe('ConflictResolver', () => {
  describe('detectConflicts', () => {
    it('should detect overlapping operations as conflicts', () => {
      const op1: DocumentChange = {
        id: '1',
        type: 'insert',
        position: 5,
        content: 'hello', // length 5, so range is 5-10
        author: 'user1',
        timestamp: new Date(),
        documentId: 'doc1',
      };

      const op2: DocumentChange = {
        id: '2',
        type: 'delete',
        position: 7, // overlaps with op1 range (5-10)
        length: 3,
        author: 'user2',
        timestamp: new Date(),
        documentId: 'doc1',
      };

      const conflicts = ConflictResolver.detectConflicts([op1, op2]);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].users).toEqual(['user1', 'user2']);
    });

    it('should not detect conflicts for non-overlapping operations', () => {
      const op1: DocumentChange = {
        id: '1',
        type: 'insert',
        position: 5,
        content: 'hello',
        author: 'user1',
        timestamp: new Date(),
        documentId: 'doc1',
      };

      const op2: DocumentChange = {
        id: '2',
        type: 'insert',
        position: 15,
        content: 'world',
        author: 'user2',
        timestamp: new Date(),
        documentId: 'doc1',
      };

      const conflicts = ConflictResolver.detectConflicts([op1, op2]);
      expect(conflicts).toHaveLength(0);
    });
  });

  describe('resolveConflict', () => {
    it('should resolve conflict with last-writer-wins strategy', async () => {
      const now = new Date();
      const earlier = new Date(now.getTime() - 1000);

      const conflict: EditConflict = {
        id: 'conflict1',
        documentId: 'doc1',
        conflictingOperations: [
          {
            id: '1',
            type: 'insert',
            position: 5,
            content: 'first',
            author: 'user1',
            timestamp: earlier,
            documentId: 'doc1',
          },
          {
            id: '2',
            type: 'insert',
            position: 5,
            content: 'second',
            author: 'user2',
            timestamp: now,
            documentId: 'doc1',
          },
        ],
        affectedRange: { start: 5, end: 10 },
        users: ['user1', 'user2'],
        timestamp: now,
      };

      const resolution: ConflictResolution = {
        strategy: 'last-writer-wins',
      };

      const resolved = await ConflictResolver.resolveConflict(conflict, resolution);
      expect(resolved).toHaveLength(1);
      expect(resolved[0].content).toBe('second');
      expect(resolved[0].author).toBe('user2');
    });

    it('should resolve conflict with manual strategy', async () => {
      const conflict: EditConflict = {
        id: 'conflict1',
        documentId: 'doc1',
        conflictingOperations: [],
        affectedRange: { start: 5, end: 10 },
        users: ['user1', 'user2'],
        timestamp: new Date(),
      };

      const manualOperation: DocumentChange = {
        id: 'manual1',
        type: 'insert',
        position: 5,
        content: 'resolved',
        author: 'moderator',
        timestamp: new Date(),
        documentId: 'doc1',
      };

      const resolution: ConflictResolution = {
        strategy: 'manual',
        manualOperations: [manualOperation],
      };

      const resolved = await ConflictResolver.resolveConflict(conflict, resolution);
      expect(resolved).toEqual([manualOperation]);
    });
  });
});

describe('CollaborationService', () => {
  let server: HTTPServer;
  let collaborationService: CollaborationService;
  let clientSocket: SocketIOClient;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Setup JWT mock
    (jwt.verify as Mock).mockReturnValue({ userId: 'user1' });

    // Setup Prisma mocks
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user1',
      name: 'Test User',
      email: 'test@example.com',
      avatar: null,
    });

    mockPrisma.specificationDocument.findFirst.mockResolvedValue({
      id: 'doc1',
      content: 'Initial content',
    });

    mockPrisma.specificationDocument.findUnique.mockResolvedValue({
      id: 'doc1',
      content: 'Initial content',
      version: 1,
      updatedAt: new Date(),
    });

    mockPrisma.specificationDocument.update.mockResolvedValue({
      id: 'doc1',
      content: 'Updated content',
      version: 2,
    });

    // Setup Redis mocks
    mockRedis.lrange.mockResolvedValue([]);
    mockRedis.lpush.mockResolvedValue(1);
    mockRedis.ltrim.mockResolvedValue('OK');
    mockRedis.expire.mockResolvedValue(1);

    // Create HTTP server
    server = new HTTPServer();
    
    // Create collaboration service
    collaborationService = new CollaborationService(server, mockRedis, mockPrisma as any);
  });

  afterEach(() => {
    if (clientSocket) {
      clientSocket.disconnect();
    }
    if (server) {
      server.close();
    }
  });

  describe('initialization', () => {
    it('should initialize collaboration service correctly', () => {
      expect(collaborationService).toBeDefined();
      expect(collaborationService.getCollaborationStats).toBeDefined();
    });

    it('should return initial collaboration stats', () => {
      const stats = collaborationService.getCollaborationStats();
      expect(stats).toEqual({
        activeDocuments: 0,
        totalUsers: 0,
        documentUsers: {},
      });
    });
  });

  describe('document access validation', () => {
    it('should validate document access for project owner', async () => {
      mockPrisma.specificationDocument.findFirst.mockResolvedValue({
        id: 'doc1',
        project: { ownerId: 'user1' },
      });

      // Access private method through service instance
      const hasAccess = await (collaborationService as any).validateDocumentAccess('user1', 'doc1');
      expect(hasAccess).toBe(true);
    });

    it('should validate document access for team member', async () => {
      mockPrisma.specificationDocument.findFirst.mockResolvedValue({
        id: 'doc1',
        project: {
          team: [{ userId: 'user1', status: 'ACTIVE' }],
        },
      });

      const hasAccess = await (collaborationService as any).validateDocumentAccess('user1', 'doc1');
      expect(hasAccess).toBe(true);
    });

    it('should deny access for unauthorized user', async () => {
      mockPrisma.specificationDocument.findFirst.mockResolvedValue(null);

      const hasAccess = await (collaborationService as any).validateDocumentAccess('user1', 'doc1');
      expect(hasAccess).toBe(false);
    });
  });

  describe('user color assignment', () => {
    it('should assign consistent colors for same user', () => {
      const color1 = (collaborationService as any).assignUserColor('user1');
      const color2 = (collaborationService as any).assignUserColor('user1');
      expect(color1).toBe(color2);
    });

    it('should assign different colors for different users', () => {
      const color1 = (collaborationService as any).assignUserColor('user1');
      const color2 = (collaborationService as any).assignUserColor('user2');
      expect(color1).not.toBe(color2);
    });

    it('should assign colors from predefined palette', () => {
      const color = (collaborationService as any).assignUserColor('user1');
      const expectedColors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
        '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
      ];
      expect(expectedColors).toContain(color);
    });
  });

  describe('operational transformation', () => {
    it('should apply operational transformation to document changes', async () => {
      const change: DocumentChange = {
        id: '1',
        type: 'insert',
        position: 5,
        content: 'test',
        author: 'user1',
        timestamp: new Date(),
        documentId: 'doc1',
      };

      // Mock recent changes - the prior change should be earlier, not later
      const earlierTime = new Date(change.timestamp.getTime() - 1000);
      mockRedis.lrange.mockResolvedValue([
        JSON.stringify({
          id: '2',
          type: 'insert',
          position: 3,
          content: 'prior',
          author: 'user2',
          timestamp: earlierTime,
          documentId: 'doc1',
        }),
      ]);

      const transformed = await (collaborationService as any).applyOperationalTransform(change);
      // Since the prior change is earlier, no transformation should occur
      expect(transformed.position).toBe(5);
    });
  });

  describe('document updates', () => {
    it('should update document content correctly', async () => {
      const change: DocumentChange = {
        id: '1',
        type: 'insert',
        position: 7,
        content: ' updated',
        author: 'user1',
        timestamp: new Date(),
        documentId: 'doc1',
      };

      await (collaborationService as any).updateDocument('doc1', change);

      expect(mockPrisma.specificationDocument.update).toHaveBeenCalledWith({
        where: { id: 'doc1' },
        data: {
          content: 'Initial updated content',
          version: { increment: 1 },
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should throw error for non-existent document', async () => {
      mockPrisma.specificationDocument.findUnique.mockResolvedValue(null);

      const change: DocumentChange = {
        id: '1',
        type: 'insert',
        position: 0,
        content: 'test',
        author: 'user1',
        timestamp: new Date(),
        documentId: 'nonexistent',
      };

      await expect(
        (collaborationService as any).updateDocument('nonexistent', change)
      ).rejects.toThrow('Document not found');
    });
  });

  describe('change storage', () => {
    it('should store document changes in Redis', async () => {
      const change: DocumentChange = {
        id: '1',
        type: 'insert',
        position: 5,
        content: 'test',
        author: 'user1',
        timestamp: new Date(),
        documentId: 'doc1',
      };

      await (collaborationService as any).storeDocumentChange(change);

      expect(mockRedis.lpush).toHaveBeenCalledWith(
        'doc_changes:doc1',
        JSON.stringify(change)
      );
      expect(mockRedis.ltrim).toHaveBeenCalledWith('doc_changes:doc1', 0, 99);
      expect(mockRedis.expire).toHaveBeenCalledWith('doc_changes:doc1', 3600);
    });

    it('should retrieve recent document changes from Redis', async () => {
      const mockChange = {
        id: '1',
        type: 'insert',
        position: 5,
        content: 'test',
        author: 'user1',
        timestamp: new Date(),
        documentId: 'doc1',
      };

      mockRedis.lrange.mockResolvedValue([JSON.stringify(mockChange)]);

      const changes = await (collaborationService as any).getRecentDocumentChanges('doc1');

      expect(mockRedis.lrange).toHaveBeenCalledWith('doc_changes:doc1', 0, 49);
      expect(changes).toHaveLength(1);
      // Compare properties individually to handle date serialization
      expect(changes[0].id).toBe(mockChange.id);
      expect(changes[0].type).toBe(mockChange.type);
      expect(changes[0].position).toBe(mockChange.position);
      expect(changes[0].content).toBe(mockChange.content);
      expect(changes[0].author).toBe(mockChange.author);
      expect(changes[0].documentId).toBe(mockChange.documentId);
    });
  });
});