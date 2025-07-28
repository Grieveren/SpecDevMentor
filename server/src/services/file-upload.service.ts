import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { Request } from 'express';

interface FileUploadOptions {
  maxFileSize?: number;
  allowedMimeTypes?: string[];
  destination?: string;
  preserveOriginalName?: boolean;
}

interface UploadedFileInfo {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  url?: string;
  checksum: string;
}

export class FileUploadService {
  private prisma: PrismaClient;
  private uploadDir: string;

  constructor(prisma: PrismaClient, uploadDir: string = 'uploads') {
    this.prisma = prisma;
    this.uploadDir = uploadDir;
    this.ensureUploadDirectory();
  }

  /**
   * Create multer middleware for file uploads
   */
  createUploadMiddleware(options: FileUploadOptions = {}) {
    const {
      maxFileSize = 10 * 1024 * 1024, // 10MB default
      allowedMimeTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
        'text/plain',
        'text/markdown',
        'application/json',
        'application/zip',
      ],
      destination = this.uploadDir,
      preserveOriginalName = false,
    } = options;

    const storage = multer.diskStorage({
      destination: async (req, file, cb) => {
        const uploadPath = path.join(destination, this.getDatePath());
        await this.ensureDirectory(uploadPath);
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        if (preserveOriginalName) {
          cb(null, file.originalname);
        } else {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
          const ext = path.extname(file.originalname);
          cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
        }
      },
    });

    return multer({
      storage,
      limits: {
        fileSize: maxFileSize,
        files: 10, // Max 10 files per request
      },
      fileFilter: (req, file, cb) => {
        // Check MIME type
        if (!allowedMimeTypes.includes(file.mimetype)) {
          return cb(new Error(`File type ${file.mimetype} not allowed`));
        }

        // Additional security checks
        if (this.isExecutableFile(file.originalname)) {
          return cb(new Error('Executable files are not allowed'));
        }

        cb(null, true);
      },
    });
  }

  /**
   * Process uploaded files and save to database
   */
  async processUploadedFiles(
    files: Express.Multer.File[],
    uploaderId: string,
    documentId?: string
  ): Promise<UploadedFileInfo[]> {
    const processedFiles: UploadedFileInfo[] = [];

    for (const file of files) {
      try {
        // Calculate file checksum
        const checksum = await this.calculateChecksum(file.path);

        // Check for duplicate files
        const existingFile = await this.findDuplicateFile(checksum, uploaderId);
        if (existingFile) {
          // Remove uploaded file and return existing file info
          await fs.unlink(file.path);
          processedFiles.push({
            id: existingFile.id,
            filename: existingFile.filename,
            originalName: existingFile.originalName,
            mimeType: existingFile.mimeType,
            size: existingFile.size,
            path: existingFile.path,
            url: existingFile.url,
            checksum: existingFile.checksum,
          });
          continue;
        }

        // Save file info to database
        const fileRecord = await this.prisma.fileAttachment.create({
          data: {
            filename: file.filename,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            path: file.path,
            checksum,
            uploaderId,
            documentId,
            metadata: {
              encoding: file.encoding,
              fieldname: file.fieldname,
            },
          },
        });

        // Create initial version
        await this.prisma.fileVersion.create({
          data: {
            attachmentId: fileRecord.id,
            version: 1,
            filename: file.filename,
            path: file.path,
            size: file.size,
            checksum,
            metadata: {
              encoding: file.encoding,
            },
          },
        });

        processedFiles.push({
          id: fileRecord.id,
          filename: fileRecord.filename,
          originalName: fileRecord.originalName,
          mimeType: fileRecord.mimeType,
          size: fileRecord.size,
          path: fileRecord.path,
          url: fileRecord.url,
          checksum: fileRecord.checksum,
        });
      } catch (error) {
        console.error(`Failed to process file ${file.originalname}:`, error);
        // Clean up file on error
        try {
          await fs.unlink(file.path);
        } catch (unlinkError) {
          console.error('Failed to clean up file:', unlinkError);
        }
        throw error;
      }
    }

    return processedFiles;
  }

  /**
   * Get file by ID
   */
  async getFile(fileId: string, userId?: string): Promise<any> {
    const file = await this.prisma.fileAttachment.findUnique({
      where: { id: fileId },
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

    if (!file) {
      throw new Error('File not found');
    }

    // Check permissions
    if (userId && !file.isPublic) {
      const hasAccess = await this.checkFileAccess(file, userId);
      if (!hasAccess) {
        throw new Error('Access denied');
      }
    }

    return file;
  }

  /**
   * Get files for a document
   */
  async getDocumentFiles(documentId: string, userId: string): Promise<any[]> {
    // First check if user has access to the document
    const document = await this.prisma.specificationDocument.findUnique({
      where: { id: documentId },
      include: {
        project: {
          include: {
            owner: true,
            team: {
              where: { status: 'ACTIVE' },
              include: { user: true },
            },
          },
        },
      },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    const hasAccess = document.project.owner.id === userId ||
      document.project.team.some(member => member.user.id === userId);

    if (!hasAccess) {
      throw new Error('Access denied');
    }

    return await this.prisma.fileAttachment.findMany({
      where: { documentId },
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
  }

  /**
   * Update file version
   */
  async updateFileVersion(
    fileId: string,
    newFile: Express.Multer.File,
    userId: string
  ): Promise<UploadedFileInfo> {
    const existingFile = await this.getFile(fileId, userId);
    
    if (existingFile.uploaderId !== userId) {
      throw new Error('Only the file owner can update versions');
    }

    const checksum = await this.calculateChecksum(newFile.path);
    
    // Get next version number
    const latestVersion = await this.prisma.fileVersion.findFirst({
      where: { attachmentId: fileId },
      orderBy: { version: 'desc' },
    });

    const nextVersion = (latestVersion?.version || 0) + 1;

    // Create new version
    await this.prisma.fileVersion.create({
      data: {
        attachmentId: fileId,
        version: nextVersion,
        filename: newFile.filename,
        path: newFile.path,
        size: newFile.size,
        checksum,
        metadata: {
          encoding: newFile.encoding,
        },
      },
    });

    // Update main file record
    const updatedFile = await this.prisma.fileAttachment.update({
      where: { id: fileId },
      data: {
        filename: newFile.filename,
        path: newFile.path,
        size: newFile.size,
        checksum,
        updatedAt: new Date(),
      },
    });

    return {
      id: updatedFile.id,
      filename: updatedFile.filename,
      originalName: updatedFile.originalName,
      mimeType: updatedFile.mimeType,
      size: updatedFile.size,
      path: updatedFile.path,
      url: updatedFile.url,
      checksum: updatedFile.checksum,
    };
  }

  /**
   * Delete file
   */
  async deleteFile(fileId: string, userId: string): Promise<void> {
    const file = await this.getFile(fileId, userId);
    
    if (file.uploaderId !== userId) {
      throw new Error('Only the file owner can delete files');
    }

    // Delete file versions from filesystem
    const versions = await this.prisma.fileVersion.findMany({
      where: { attachmentId: fileId },
    });

    for (const version of versions) {
      try {
        await fs.unlink(version.path);
      } catch (error) {
        console.error(`Failed to delete file version ${version.path}:`, error);
      }
    }

    // Delete main file from filesystem
    try {
      await fs.unlink(file.path);
    } catch (error) {
      console.error(`Failed to delete main file ${file.path}:`, error);
    }

    // Delete from database (cascade will handle versions)
    await this.prisma.fileAttachment.delete({
      where: { id: fileId },
    });
  }

  /**
   * Get file stream for download
   */
  async getFileStream(fileId: string, userId?: string): Promise<{ stream: any; file: any }> {
    const file = await this.getFile(fileId, userId);
    
    // Check if file exists on filesystem
    try {
      await fs.access(file.path);
    } catch (error) {
      throw new Error('File not found on storage');
    }

    const fs_stream = require('fs');
    const stream = fs_stream.createReadStream(file.path);
    
    return { stream, file };
  }

  /**
   * Clean up expired files
   */
  async cleanupExpiredFiles(): Promise<void> {
    const expiredFiles = await this.prisma.fileAttachment.findMany({
      where: {
        expiresAt: { lt: new Date() },
      },
      include: { versions: true },
    });

    for (const file of expiredFiles) {
      try {
        // Delete file versions from filesystem
        for (const version of file.versions) {
          await fs.unlink(version.path);
        }
        
        // Delete main file from filesystem
        await fs.unlink(file.path);
        
        // Delete from database
        await this.prisma.fileAttachment.delete({
          where: { id: file.id },
        });
      } catch (error) {
        console.error(`Failed to cleanup expired file ${file.id}:`, error);
      }
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(userId?: string): Promise<{
    totalFiles: number;
    totalSize: number;
    filesByType: Record<string, number>;
    sizeByType: Record<string, number>;
  }> {
    const where = userId ? { uploaderId: userId } : {};
    
    const files = await this.prisma.fileAttachment.findMany({
      where,
      select: { mimeType: true, size: true },
    });

    const stats = {
      totalFiles: files.length,
      totalSize: files.reduce((sum, file) => sum + file.size, 0),
      filesByType: {} as Record<string, number>,
      sizeByType: {} as Record<string, number>,
    };

    files.forEach(file => {
      const type = file.mimeType.split('/')[0];
      stats.filesByType[type] = (stats.filesByType[type] || 0) + 1;
      stats.sizeByType[type] = (stats.sizeByType[type] || 0) + file.size;
    });

    return stats;
  }

  /**
   * Private helper methods
   */
  private async ensureUploadDirectory(): Promise<void> {
    await this.ensureDirectory(this.uploadDir);
  }

  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  private getDatePath(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    const fileBuffer = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  }

  private async findDuplicateFile(checksum: string, uploaderId: string): Promise<any> {
    return await this.prisma.fileAttachment.findFirst({
      where: {
        checksum,
        uploaderId,
      },
    });
  }

  private isExecutableFile(filename: string): boolean {
    const executableExtensions = [
      '.exe', '.bat', '.cmd', '.com', '.scr', '.pif',
      '.sh', '.bash', '.zsh', '.fish',
      '.app', '.dmg', '.pkg',
      '.deb', '.rpm',
      '.jar', '.war',
    ];
    
    const ext = path.extname(filename).toLowerCase();
    return executableExtensions.includes(ext);
  }

  private async checkFileAccess(file: any, userId: string): Promise<boolean> {
    // File owner always has access
    if (file.uploaderId === userId) {
      return true;
    }

    // If file is attached to a document, check document access
    if (file.documentId) {
      const document = await this.prisma.specificationDocument.findUnique({
        where: { id: file.documentId },
        include: {
          project: {
            include: {
              owner: true,
              team: {
                where: { status: 'ACTIVE' },
                include: { user: true },
              },
            },
          },
        },
      });

      if (document) {
        return document.project.owner.id === userId ||
          document.project.team.some(member => member.user.id === userId);
      }
    }

    return false;
  }
}