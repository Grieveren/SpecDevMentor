import { Menu, Transition } from '@headlessui/react';
import {
  ArrowDownTrayIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  DocumentIcon,
  EyeIcon,
  TrashIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';
import React, { Fragment, useEffect, useState } from 'react';
import { FileAttachment, fileUploadService } from '../../services/file-upload.service';
import { cn } from '../../utils/cn';

interface FileListProps {
  documentId?: string;
  files?: FileAttachment[];
  onFileDeleted?: (fileId: string) => void;
  onFileUpdated?: (file: FileAttachment) => void;
  showUploader?: boolean;
  showVersions?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const FileList: React.FC<FileListProps> = ({
  documentId,
  files: propFiles,
  onFileDeleted,
  onFileUpdated,
  showUploader = true,
  showVersions = true,
  className,
}) => {
  const [files, setFiles] = useState<FileAttachment[]>(propFiles || []);
  const [loading, setLoading] = useState(!propFiles);
  const [error, setError] = useState<string | null>(null);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!propFiles && documentId) {
      loadFiles();
    }
  }, [documentId, propFiles]);

  useEffect(() => {
    if (propFiles) {
      setFiles(propFiles);
    }
  }, [propFiles]);

  const loadFiles = async () => {
    if (!documentId) return;

    try {
      setLoading(true);
      setError(null);
      const documentFiles = await fileUploadService.getDocumentFiles(documentId);
      setFiles(documentFiles);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (file: FileAttachment) => {
    try {
      await fileUploadService.downloadFile(file.id, file.originalName);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to download file');
    }
  };

  const handleDelete = async (file: FileAttachment) => {
    if (!confirm(`Are you sure you want to delete "${file.originalName}"?`)) {
      return;
    }

    try {
      await fileUploadService.deleteFile(file.id);
      setFiles(prev => prev.filter(f => f.id !== file.id));
      onFileDeleted?.(file.id);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to delete file');
    }
  };

  const handleVersionUpdate = async (file: FileAttachment, newFile: File) => {
    try {
      const updatedFile = await fileUploadService.updateFileVersion(file.id, newFile, progress => {
        // Could show progress here
      });

      setFiles(prev => prev.map(f => (f.id === file.id ? updatedFile : f)));
      onFileUpdated?.(updatedFile);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to update file version');
    }
  };

  const toggleFileExpansion = (fileId: string) => {
    setExpandedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center py-8', className)}>
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('text-center py-8', className)}>
        <p className="text-red-600 mb-2">{error}</p>
        <button onClick={loadFiles} className="text-blue-600 hover:text-blue-800 text-sm">
          Try again
        </button>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className={cn('text-center py-8 text-gray-500', className)}>
        <DocumentIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
        <p>No files attached</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {files.map(file => (
        <FileItem
          key={file.id}
          file={file}
          onDownload={handleDownload}
          onDelete={handleDelete}
          onVersionUpdate={handleVersionUpdate}
          showUploader={showUploader}
          showVersions={showVersions}
          isExpanded={expandedFiles.has(file.id)}
          onToggleExpansion={() => toggleFileExpansion(file.id)}
        />
      ))}
    </div>
  );
};

interface FileItemProps {
  file: FileAttachment;
  onDownload: (file: FileAttachment) => void;
  onDelete: (file: FileAttachment) => void;
  onVersionUpdate: (file: FileAttachment, newFile: File) => void;
  showUploader: boolean;
  showVersions: boolean;
  isExpanded: boolean;
  onToggleExpansion: () => void;
}

const FileItem: React.FC<FileItemProps> = ({
  file,
  onDownload,
  onDelete,
  onVersionUpdate,
  showUploader,
  showVersions,
  isExpanded,
  onToggleExpansion,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleVersionUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      onVersionUpdate(file, selectedFile);
    }
    e.target.value = '';
  };

  const hasVersions = file.versions && file.versions.length > 0;

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
      <div className="flex items-center space-x-3">
        {/* File Icon */}
        <div className="flex-shrink-0">
          <span className="text-2xl">{fileUploadService.getFileTypeIcon(file.mimeType)}</span>
        </div>

        {/* File Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <h4 className="text-sm font-medium text-gray-900 truncate">{file.originalName}</h4>
            <span className="text-xs text-gray-500">
              {fileUploadService.formatFileSize(file.size)}
            </span>
          </div>

          <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500">
            {showUploader && (
              <div className="flex items-center space-x-1">
                <UserIcon className="h-3 w-3" />
                <span>{file.uploader.name}</span>
              </div>
            )}

            <div className="flex items-center space-x-1">
              <ClockIcon className="h-3 w-3" />
              <span>{formatDistanceToNow(new Date(file.createdAt), { addSuffix: true })}</span>
            </div>

            {hasVersions && showVersions && (
              <span className="text-blue-600">
                {file.versions!.length} version{file.versions!.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-2">
          {hasVersions && showVersions && (
            <button
              onClick={onToggleExpansion}
              className="p-1 text-gray-400 hover:text-gray-600"
              title={isExpanded ? 'Hide versions' : 'Show versions'}
            >
              {isExpanded ? (
                <ChevronDownIcon className="h-4 w-4" />
              ) : (
                <ChevronRightIcon className="h-4 w-4" />
              )}
            </button>
          )}

          <Menu as="div" className="relative">
            <Menu.Button className="p-1 text-gray-400 hover:text-gray-600">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </Menu.Button>

            <Transition
              as={Fragment}
              enter="transition ease-out duration-100"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <Menu.Items className="absolute right-0 z-10 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                <div className="py-1">
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={() => onDownload(file)}
                        className={cn(
                          'flex items-center space-x-2 w-full px-4 py-2 text-sm text-left',
                          active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                        )}
                      >
                        <ArrowDownTrayIcon className="h-4 w-4" />
                        <span>Download</span>
                      </button>
                    )}
                  </Menu.Item>

                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className={cn(
                          'flex items-center space-x-2 w-full px-4 py-2 text-sm text-left',
                          active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                        )}
                      >
                        <EyeIcon className="h-4 w-4" />
                        <span>New Version</span>
                      </button>
                    )}
                  </Menu.Item>

                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={() => onDelete(file)}
                        className={cn(
                          'flex items-center space-x-2 w-full px-4 py-2 text-sm text-left',
                          active ? 'bg-gray-100 text-red-900' : 'text-red-700'
                        )}
                      >
                        <TrashIcon className="h-4 w-4" />
                        <span>Delete</span>
                      </button>
                    )}
                  </Menu.Item>
                </div>
              </Menu.Items>
            </Transition>
          </Menu>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleVersionUpload}
            accept={file.mimeType}
          />
        </div>
      </div>

      {/* Version History */}
      {isExpanded && hasVersions && (
        <div className="mt-4 pl-8 border-l-2 border-gray-200">
          <h5 className="text-xs font-medium text-gray-700 mb-2">Version History</h5>
          <div className="space-y-2">
            {file.versions!.map(version => (
              <div
                key={version.id}
                className="flex items-center justify-between text-xs text-gray-500"
              >
                <div className="flex items-center space-x-2">
                  <span>v{version.version}</span>
                  <span>{fileUploadService.formatFileSize(version.size)}</span>
                  <span>
                    {formatDistanceToNow(new Date(version.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <button
                  onClick={() => onDownload(file)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  Download
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
