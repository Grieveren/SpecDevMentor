import { AxiosRequestConfig } from 'axios';
import { BaseService, typedApiClient } from './api.service';

export interface FileAttachment {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  url?: string;
  checksum: string;
  createdAt: string;
  updatedAt: string;
  uploader: {
    id: string;
    name: string;
    email: string;
  };
  versions?: FileVersion[];
}

export interface FileVersion {
  id: string;
  version: number;
  filename: string;
  size: number;
  checksum: string;
  createdAt: string;
}

export interface StorageStats {
  totalFiles: number;
  totalSize: number;
  filesByType: Record<string, number>;
  sizeByType: Record<string, number>;
}

export interface UploadProgress {
  fileId: string;
  filename: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  error?: string;
}

export class FileUploadService extends BaseService {
  constructor() {
    super(typedApiClient);
  }

  /**
   * Upload files
   */
  async uploadFiles(
    files: File[],
    documentId?: string,
    onProgress?: (progress: UploadProgress[]) => void
  ): Promise<FileAttachment[]> {
    const formData = new FormData();

    files.forEach(file => {
      formData.append('files', file);
    });

    if (documentId) {
      formData.append('documentId', documentId);
    }

    const progressArray: UploadProgress[] = files.map(file => ({
      fileId: `temp-${Date.now()}-${Math.random()}`,
      filename: file.name,
      progress: 0,
      status: 'uploading',
    }));

    if (onProgress) {
      onProgress(progressArray);
    }

    try {
      const config: AxiosRequestConfig = {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: progressEvent => {
          if (progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            const updatedProgress: UploadProgress[] = progressArray.map(p => ({
              ...p,
              progress,
              status: progress === 100 ? 'completed' : 'uploading',
            }));

            if (onProgress) {
              onProgress(updatedProgress);
            }
          }
        },
      };

      const response = await this.apiClient.post<{ files: FileAttachment[] }>(
        '/files/upload',
        formData,
        config
      );
      return this.validateResponse(response).files;
    } catch (error: unknown) {
      const errorProgress = progressArray.map(p => ({
        ...p,
        status: 'error' as UploadProgress['status'],
        error: this.handleError(error).message || 'Upload failed',
      }));

      if (onProgress) {
        onProgress(errorProgress);
      }

      throw this.handleError(error);
    }
  }

  /**
   * Get file by ID
   */
  async getFile(fileId: string): Promise<FileAttachment> {
    try {
      const response = await this.apiClient.get<FileAttachment>(`/files/${fileId}`);
      return this.validateResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Download file
   */
  async downloadFile(fileId: string, filename?: string): Promise<void> {
    try {
      const response = await this.apiClient.get<Blob>(`/files/${fileId}/download`, {
        responseType: 'blob',
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get files for a document
   */
  async getDocumentFiles(documentId: string): Promise<FileAttachment[]> {
    try {
      const response = await this.apiClient.get<{ files: FileAttachment[] }>(
        `/files/document/${documentId}`
      );
      return this.validateResponse(response).files;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Update file version
   */
  async updateFileVersion(
    fileId: string,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<FileAttachment> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const config: AxiosRequestConfig = {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: progressEvent => {
          if (progressEvent.total && onProgress) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(progress);
          }
        },
      };

      const response = await this.apiClient.post<FileAttachment>(
        `/files/${fileId}/version`,
        formData,
        config
      );
      return this.validateResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Delete file
   */
  async deleteFile(fileId: string): Promise<void> {
    try {
      const response = await this.apiClient.delete<void>(`/files/${fileId}`);
      this.validateResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(global = false): Promise<StorageStats> {
    try {
      const response = await this.apiClient.get<StorageStats>('/files/stats/storage', {
        params: { global },
      });
      return this.validateResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get file type icon
   */
  getFileTypeIcon(mimeType: string): string {
    const type = mimeType.split('/')[0];
    const subtype = mimeType.split('/')[1];

    switch (type) {
      case 'image':
        return '🖼️';
      case 'video':
        return '🎥';
      case 'audio':
        return '🎵';
      case 'text':
        return '📄';
      case 'application':
        switch (subtype) {
          case 'pdf':
            return '📕';
          case 'zip':
          case 'x-zip-compressed':
            return '📦';
          case 'json':
            return '📋';
          case 'msword':
          case 'vnd.openxmlformats-officedocument.wordprocessingml.document':
            return '📝';
          default:
            return '📄';
        }
      default:
        return '📄';
    }
  }

  /**
   * Validate file before upload
   */
  validateFile(
    file: File,
    options: {
      maxSize?: number;
      allowedTypes?: string[];
    } = {}
  ): { valid: boolean; error?: string } {
    const {
      maxSize = 10 * 1024 * 1024, // 10MB default
      allowedTypes = [
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
    } = options;

    // Check file size
    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File size exceeds ${this.formatFileSize(maxSize)} limit`,
      };
    }

    // Check file type
    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: `File type ${file.type} is not allowed`,
      };
    }

    // Check for executable files
    const executableExtensions = [
      '.exe',
      '.bat',
      '.cmd',
      '.com',
      '.scr',
      '.pif',
      '.sh',
      '.bash',
      '.zsh',
      '.fish',
      '.app',
      '.dmg',
      '.pkg',
      '.deb',
      '.rpm',
      '.jar',
      '.war',
    ];

    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (executableExtensions.includes(extension)) {
      return {
        valid: false,
        error: 'Executable files are not allowed',
      };
    }

    return { valid: true };
  }
}

export const fileUploadService = new FileUploadService();
