import { Router } from 'express';
import { param, query } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { FileUploadService } from '../services/file-upload.service.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { validationMiddleware } from '../middleware/validation.middleware.js';

const router = Router();
const prisma = new PrismaClient();
const fileUploadService = new FileUploadService(prisma);

/**
 * Upload files
 */
router.post(
  '/upload',
  authMiddleware,
  (req, res, next) => {
    const uploadMiddleware = fileUploadService.createUploadMiddleware({
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedMimeTypes: [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml',
        'application/pdf',
        'text/plain',
        'text/markdown',
        'application/json',
        'application/zip',
        'application/x-zip-compressed',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
    });

    uploadMiddleware.array('files', 10)(req, res, next);
  },
  async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      const userId = req.user!.id;
      const documentId = req.body.documentId;

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No files uploaded',
        });
      }

      const processedFiles = await fileUploadService.processUploadedFiles(
        files,
        userId,
        documentId
      );

      res.json({
        success: true,
        data: {
          files: processedFiles,
          count: processedFiles.length,
        },
        message: `${processedFiles.length} file(s) uploaded successfully`,
      });
    } catch (error) {
      console.error('File upload error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'File upload failed',
      });
    }
  }
);

/**
 * Get file by ID
 */
router.get(
  '/:id',
  authMiddleware,
  [param('id').isString().notEmpty()],
  validationMiddleware,
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const _file = await fileUploadService.getFile(id, userId);

      res.json({
        success: true,
        data: file,
      });
    } catch (error) {
      console.error('Get file error:', error);
      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 :
                         error instanceof Error && error.message.includes('Access denied') ? 403 : 500;
      
      res.status(statusCode).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get file',
      });
    }
  }
);

/**
 * Download file
 */
router.get(
  '/:id/download',
  authMiddleware,
  [param('id').isString().notEmpty()],
  validationMiddleware,
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const { stream, file } = await fileUploadService.getFileStream(id, userId);

      // Set appropriate headers
      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Content-Length', file.size);
      res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);

      // Pipe file stream to response
      stream.pipe(res);
    } catch (error) {
      console.error('File download error:', error);
      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 :
                         error instanceof Error && error.message.includes('Access denied') ? 403 : 500;
      
      res.status(statusCode).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to download file',
      });
    }
  }
);

/**
 * Get files for a document
 */
router.get(
  '/document/:documentId',
  authMiddleware,
  [param('documentId').isString().notEmpty()],
  validationMiddleware,
  async (req, res) => {
    try {
      const { documentId } = req.params;
      const userId = req.user!.id;

      const files = await fileUploadService.getDocumentFiles(documentId, userId);

      res.json({
        success: true,
        data: {
          files,
          count: files.length,
        },
      });
    } catch (error) {
      console.error('Get document files error:', error);
      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 :
                         error instanceof Error && error.message.includes('Access denied') ? 403 : 500;
      
      res.status(statusCode).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get document files',
      });
    }
  }
);

/**
 * Update file version
 */
router.post(
  '/:id/version',
  authMiddleware,
  [param('id').isString().notEmpty()],
  validationMiddleware,
  (req, res, next) => {
    const uploadMiddleware = fileUploadService.createUploadMiddleware({
      maxFileSize: 10 * 1024 * 1024, // 10MB
    });

    uploadMiddleware.single('file')(req, res, next);
  },
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const _file = req.file as Express.Multer.File;

      if (!file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded',
        });
      }

      const updatedFile = await fileUploadService.updateFileVersion(id, file, userId);

      res.json({
        success: true,
        data: updatedFile,
        message: 'File version updated successfully',
      });
    } catch (error) {
      console.error('File version update error:', error);
      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 :
                         error instanceof Error && error.message.includes('Access denied') ? 403 : 500;
      
      res.status(statusCode).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update file version',
      });
    }
  }
);

/**
 * Delete file
 */
router.delete(
  '/:id',
  authMiddleware,
  [param('id').isString().notEmpty()],
  validationMiddleware,
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      await fileUploadService.deleteFile(id, userId);

      res.json({
        success: true,
        message: 'File deleted successfully',
      });
    } catch (error) {
      console.error('File deletion error:', error);
      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 :
                         error instanceof Error && error.message.includes('Access denied') ? 403 : 500;
      
      res.status(statusCode).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete file',
      });
    }
  }
);

/**
 * Get storage statistics
 */
router.get(
  '/stats/storage',
  authMiddleware,
  [
    query('global').optional().isBoolean().toBoolean(),
  ],
  validationMiddleware,
  async (req, res) => {
    try {
      const userId = req.user!.id;
      const global = req.query.global as boolean;

      // Only admins can view global stats
      if (global && req.user!.role !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Admin access required for global statistics',
        });
      }

      const stats = await fileUploadService.getStorageStats(global ? undefined : userId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('Storage stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get storage statistics',
      });
    }
  }
);

/**
 * Cleanup expired files (admin only)
 */
router.post(
  '/cleanup/expired',
  authMiddleware,
  async (req, res) => {
    try {
      if (req.user!.role !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Admin access required',
        });
      }

      await fileUploadService.cleanupExpiredFiles();

      res.json({
        success: true,
        message: 'Expired files cleaned up successfully',
      });
    } catch (error) {
      console.error('Cleanup error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to cleanup expired files',
      });
    }
  }
);

export default router;