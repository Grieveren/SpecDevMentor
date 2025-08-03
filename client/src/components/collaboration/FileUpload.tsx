// @ts-nocheck
import React, { useState, useRef, useCallback } from 'react';
import { CloudArrowUpIcon, DocumentIcon, XMarkIcon, CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { cn } from '../../utils/cn';
import { fileUploadService, FileAttachment, UploadProgress } from '../../services/file-upload.service';

interface FileUploadProps {
  documentId?: string;
  onUploadComplete?: (files: FileAttachment[]) => void;
  onUploadError?: (error: string) => void;
  maxFiles?: number;
  maxFileSize?: number;
  allowedTypes?: string[];
  className?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  documentId,
  onUploadComplete,
  onUploadError,
  maxFiles = 10,
  maxFileSize = 10 * 1024 * 1024, // 10MB
  allowedTypes,
  className,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    
    // Validate files
    const validationErrors: string[] = [];
    const validFiles: File[] = [];

    fileArray.forEach(file => {
      const validation = fileUploadService.validateFile(file, {
        maxSize: maxFileSize,
        allowedTypes,
      });

      if (validation.valid) {
        validFiles.push(file);
      } else {
        validationErrors.push(`${file.name}: ${validation.error}`);
      }
    });

    // Check max files limit
    if (validFiles.length > maxFiles) {
      validationErrors.push(`Maximum ${maxFiles} files allowed`);
      return;
    }

    if (validationErrors.length > 0) {
      onUploadError?.(validationErrors.join('\n'));
      return;
    }

    if (validFiles.length === 0) {
      return;
    }

    try {
      setIsUploading(true);
      
      const uploadedFiles = await fileUploadService.uploadFiles(
        validFiles,
        documentId,
        setUploadProgress
      );

      onUploadComplete?.(uploadedFiles);
      setUploadProgress([]);
    } catch (error: unknown) {
      const uploadError = error as { response?: { data?: { message?: string } } };
      onUploadError?.(uploadError.response?.data?.message || 'Upload failed');
      setUploadProgress([]);
    } finally {
      setIsUploading(false);
    }
  }, [documentId, maxFiles, maxFileSize, allowedTypes, onUploadComplete, onUploadError]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files);
    }
  }, [handleFileSelect]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files);
    }
    // Reset input value to allow selecting the same file again
    e.target.value = '';
  }, [handleFileSelect]);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Upload Area */}
      <div
        className={cn(
          'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
          isDragOver
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400',
          isUploading && 'pointer-events-none opacity-50'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleInputChange}
          accept={allowedTypes?.join(',')}
        />

        <CloudArrowUpIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        
        <div className="space-y-2">
          <p className="text-lg font-medium text-gray-900">
            {isUploading ? 'Uploading...' : 'Drop files here or click to browse'}
          </p>
          <p className="text-sm text-gray-500">
            Maximum {maxFiles} files, {fileUploadService.formatFileSize(maxFileSize)} each
          </p>
          {allowedTypes && (
            <p className="text-xs text-gray-400">
              Supported: {allowedTypes.map(type => type.split('/')[1]).join(', ')}
            </p>
          )}
        </div>
      </div>

      {/* Upload Progress */}
      {uploadProgress.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-900">Upload Progress</h4>
          {uploadProgress.map((progress) => (
            <UploadProgressItem key={progress.fileId} progress={progress} />
          ))}
        </div>
      )}
    </div>
  );
};

interface UploadProgressItemProps {
  progress: UploadProgress;
}

const UploadProgressItem: React.FC<UploadProgressItemProps> = ({ progress }) => {
  const getStatusIcon = () => {
    switch (progress.status) {
      case 'completed':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'error':
        return <ExclamationCircleIcon className="h-5 w-5 text-red-500" />;
      default:
        return (
          <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        );
    }
  };

  const getStatusColor = () => {
    switch (progress.status) {
      case 'completed':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-blue-500';
    }
  };

  return (
    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
      <DocumentIcon className="h-8 w-8 text-gray-400 flex-shrink-0" />
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {progress.filename}
        </p>
        
        {progress.status === 'error' && progress.error && (
          <p className="text-xs text-red-600 mt-1">{progress.error}</p>
        )}
        
        {progress.status === 'uploading' && (
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>Uploading...</span>
              <span>{progress.progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1">
              <div
                className={cn('h-1 rounded-full transition-all', getStatusColor())}
                style={{ width: `${progress.progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex-shrink-0">
        {getStatusIcon()}
      </div>
    </div>
  );
};