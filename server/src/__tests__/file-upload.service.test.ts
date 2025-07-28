import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileUploadService } from '../services/file-upload.service.js';
import fs from 'fs/promises';
import path from 'path';

// Mock dependencies
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(),
}));

vi.mock('fs/promises');
vi.mock('crypto');

describe('FileUploadService', () => {
  let fileUploadService: FileUploadService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      fileAttachment: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      fileVersion: {
        create: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      specificationDocument: {
        findUnique: vi.fn(),
      },
    };

    fileUploadService = new FileUploadService(mockPrisma, 'test-uploads');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('processUploadedFiles', () => {
    it('should process uploaded files and save to database', async () => {
      const mockFiles = [
        {
          filename: 'test-file.jpg',
          originalname: 'original.jpg',
          mimetype: 'image/jpeg',
          size: 1024,
          path: '/uploads/test-file.jpg',
          encoding: '7bit',
          fieldname: 'files',
        },
      ] as Express.Multer.File[];

      // Mock crypto
      const mockCrypto = await import('crypto');
      (mockCrypto.createHash as any).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue('mock-checksum'),
      });

      // Mock fs
      (fs.readFile as any).mockResolvedValue(Buffer.from('test'));

      mockPrisma.fileAttachment.findFirst.mockResolvedValue(null); // No duplicate
      mockPrisma.fileAttachment.create.mockResolvedValue({
        id: 'file1',
        filename: 'test-file.jpg',
        originalName: 'original.jpg',
        mimeType: 'image/jpeg',
        size: 1024,
        path: '/uploads/test-file.jpg',
        checksum: 'mock-checksum',
        url: null,
      });

      const result = await fileUploadService.processUploadedFiles(
        mockFiles,
        'user1',
        'doc1'
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'file1',
        filename: 'test-file.jpg',
        originalName: 'original.jpg',
        mimeType: 'image/jpeg',
        size: 1024,
        path: '/uploads/test-file.jpg',
        checksum: 'mock-checksum',
        url: null,
      });

      expect(mockPrisma.fileAttachment.create).toHaveBeenCalledWith({
        data: {
          filename: 'test-file.jpg',
          originalName: 'original.jpg',
          mimeType: 'image/jpeg',
          size: 1024,
          path: '/uploads/test-file.jpg',
          checksum: 'mock-checksum',
          uploaderId: 'user1',
          documentId: 'doc1',
          metadata: {
            encoding: '7bit',
            fieldname: 'files',
          },
        },
      });

      expect(mockPrisma.fileVersion.create).toHaveBeenCalledWith({
        data: {
          attachmentId: 'file1',
          version: 1,
          filename: 'test-file.jpg',
          path: '/uploads/test-file.jpg',
          size: 1024,
          checksum: 'mock-checksum',
          metadata: {
            encoding: '7bit',
          },
        },
      });
    });

    it('should handle duplicate files', async () => {
      const mockFiles = [
        {
          filename: 'test-file.jpg',
          originalname: 'original.jpg',
          mimetype: 'image/jpeg',
          size: 1024,
          path: '/uploads/test-file.jpg',
          encoding: '7bit',
          fieldname: 'files',
        },
      ] as Express.Multer.File[];

      // Mock crypto
      const mockCrypto = await import('crypto');
      (mockCrypto.createHash as any).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue('mock-checksum'),
      });

      // Mock fs
      (fs.readFile as any).mockResolvedValue(Buffer.from('test'));
      (fs.unlink as any).mockResolvedValue(undefined);

      // Mock existing file
      const existingFile = {
        id: 'existing-file',
        filename: 'existing.jpg',
        originalName: 'existing.jpg',
        mimeType: 'image/jpeg',
        size: 1024,
        path: '/uploads/existing.jpg',
        checksum: 'mock-checksum',
        url: null,
      };

      mockPrisma.fileAttachment.findFirst.mockResolvedValue(existingFile);

      const result = await fileUploadService.processUploadedFiles(
        mockFiles,
        'user1'
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(existingFile);
      expect(fs.unlink).toHaveBeenCalledWith('/uploads/test-file.jpg');
      expect(mockPrisma.fileAttachment.create).not.toHaveBeenCalled();
    });
  });

  describe('getFile', () => {
    it('should return file with user access check', async () => {
      const mockFile = {
        id: 'file1',
        filename: 'test.jpg',
        originalName: 'test.jpg',
        mimeType: 'image/jpeg',
        size: 1024,
        path: '/uploads/test.jpg',
        isPublic: false,
        uploaderId: 'user1',
        uploader: { id: 'user1', name: 'User 1', email: 'user1@example.com' },
        document: null,
        versions: [],
      };

      mockPrisma.fileAttachment.findUnique.mockResolvedValue(mockFile);

      const result = await fileUploadService.getFile('file1', 'user1');

      expect(result).toEqual(mockFile);
      expect(mockPrisma.fileAttachment.findUnique).toHaveBeenCalledWith({
        where: { id: 'file1' },
        include: {
          uploader: {
            select: { id: true, name: true, email: true },
          },
          document: {
            select: { id: true, phase: true, projectId: true },
          },
          versions: {
            orderBy: { version: 'desc' },
            take: 5,
          },
        },
      });
    });

    it('should throw error for non-existent file', async () => {
      mockPrisma.fileAttachment.findUnique.mockResolvedValue(null);

      await expect(fileUploadService.getFile('nonexistent')).rejects.toThrow('File not found');
    });
  });

  describe('getDocumentFiles', () => {
    it('should return files for document with access check', async () => {
      const mockDocument = {
        id: 'doc1',
        project: {
          owner: { id: 'user1' },
          team: [
            { user: { id: 'user2' }, status: 'ACTIVE' },
          ],
        },
      };

      const mockFiles = [
        {
          id: 'file1',
          filename: 'test1.jpg',
          originalName: 'test1.jpg',
          uploader: { id: 'user1', name: 'User 1', email: 'user1@example.com' },
          versions: [],
        },
      ];

      mockPrisma.specificationDocument.findUnique.mockResolvedValue(mockDocument);
      mockPrisma.fileAttachment.findMany.mockResolvedValue(mockFiles);

      const result = await fileUploadService.getDocumentFiles('doc1', 'user1');

      expect(result).toEqual(mockFiles);
      expect(mockPrisma.fileAttachment.findMany).toHaveBeenCalledWith({
        where: { documentId: 'doc1' },
        include: {
          uploader: {
            select: { id: true, name: true, email: true },
          },
          versions: {
            orderBy: { version: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should throw error for unauthorized access', async () => {
      const mockDocument = {
        id: 'doc1',
        project: {
          owner: { id: 'user1' },
          team: [],
        },
      };

      mockPrisma.specificationDocument.findUnique.mockResolvedValue(mockDocument);

      await expect(
        fileUploadService.getDocumentFiles('doc1', 'user2')
      ).rejects.toThrow('Access denied');
    });
  });

  describe('updateFileVersion', () => {
    it('should create new version and update main file', async () => {
      const existingFile = {
        id: 'file1',
        uploaderId: 'user1',
        filename: 'old.jpg',
        path: '/uploads/old.jpg',
        size: 1024,
        checksum: 'old-checksum',
      };

      const newFile = {
        filename: 'new.jpg',
        path: '/uploads/new.jpg',
        size: 2048,
        encoding: '7bit',
      } as Express.Multer.File;

      // Mock crypto
      const mockCrypto = await import('crypto');
      (mockCrypto.createHash as any).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue('new-checksum'),
      });

      // Mock fs
      (fs.readFile as any).mockResolvedValue(Buffer.from('test'));

      mockPrisma.fileAttachment.findUnique.mockResolvedValue(existingFile);
      mockPrisma.fileVersion.findFirst.mockResolvedValue({ version: 1 });
      
      const updatedFile = {
        ...existingFile,
        filename: 'new.jpg',
        path: '/uploads/new.jpg',
        size: 2048,
        checksum: 'new-checksum',
      };
      
      mockPrisma.fileAttachment.update.mockResolvedValue(updatedFile);

      // Mock getFile method
      vi.spyOn(fileUploadService, 'getFile').mockResolvedValue(existingFile);

      const result = await fileUploadService.updateFileVersion('file1', newFile, 'user1');

      expect(result).toEqual({
        id: 'file1',
        filename: 'new.jpg',
        originalName: existingFile.originalName,
        mimeType: existingFile.mimeType,
        size: 2048,
        path: '/uploads/new.jpg',
        url: existingFile.url,
        checksum: 'new-checksum',
      });

      expect(mockPrisma.fileVersion.create).toHaveBeenCalledWith({
        data: {
          attachmentId: 'file1',
          version: 2,
          filename: 'new.jpg',
          path: '/uploads/new.jpg',
          size: 2048,
          checksum: 'new-checksum',
          metadata: {
            encoding: '7bit',
          },
        },
      });
    });
  });

  describe('deleteFile', () => {
    it('should delete file and versions from filesystem and database', async () => {
      const mockFile = {
        id: 'file1',
        uploaderId: 'user1',
        path: '/uploads/main.jpg',
      };

      const mockVersions = [
        { id: 'v1', path: '/uploads/v1.jpg' },
        { id: 'v2', path: '/uploads/v2.jpg' },
      ];

      // Mock getFile method
      vi.spyOn(fileUploadService, 'getFile').mockResolvedValue(mockFile);
      
      mockPrisma.fileVersion.findMany.mockResolvedValue(mockVersions);
      (fs.unlink as any).mockResolvedValue(undefined);

      await fileUploadService.deleteFile('file1', 'user1');

      expect(fs.unlink).toHaveBeenCalledWith('/uploads/v1.jpg');
      expect(fs.unlink).toHaveBeenCalledWith('/uploads/v2.jpg');
      expect(fs.unlink).toHaveBeenCalledWith('/uploads/main.jpg');
      expect(mockPrisma.fileAttachment.delete).toHaveBeenCalledWith({
        where: { id: 'file1' },
      });
    });
  });

  describe('getStorageStats', () => {
    it('should return storage statistics', async () => {
      const mockFiles = [
        { mimeType: 'image/jpeg', size: 1024 },
        { mimeType: 'image/png', size: 2048 },
        { mimeType: 'application/pdf', size: 4096 },
      ];

      mockPrisma.fileAttachment.findMany.mockResolvedValue(mockFiles);

      const result = await fileUploadService.getStorageStats('user1');

      expect(result).toEqual({
        totalFiles: 3,
        totalSize: 7168,
        filesByType: {
          image: 2,
          application: 1,
        },
        sizeByType: {
          image: 3072,
          application: 4096,
        },
      });
    });
  });
});