import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

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

export interface DocumentState {
  content: string;
  version: number;
  lastModified: Date;
}

export interface CollaborationState {
  isConnected: boolean;
  collaborators: CollaborationUser[];
  currentUser?: CollaborationUser;
  documentState?: DocumentState;
  cursors: Record<string, CursorPosition>;
  isJoining: boolean;
  error?: string;
}

export interface UseCollaborationOptions {
  documentId: string;
  token: string;
  onDocumentChange?: (change: DocumentChange) => void;
  onContentUpdate?: (content: string) => void;
  onError?: (_error: string) => void;
}

export const useCollaboration = ({
  documentId,
  token,
  onDocumentChange,
  onContentUpdate,
  onError,
}: UseCollaborationOptions) => {
  const [state, setState] = useState<CollaborationState>({
    isConnected: false,
    collaborators: [],
    cursors: {},
    isJoining: false,
  });

  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  // Initialize socket connection
  useEffect(() => {
    if (!documentId || !token) return;

    const wsUrl = process.env.REACT_APP_WS_URL || 'http://localhost:3001';
    const socket = io(wsUrl, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true,
    });

    socketRef.current = socket;

    // Connection event handlers
    socket.on('connect', () => {
      // // // console.log('Socket connected:', socket.id);
      setState(prev => ({ ...prev, isConnected: true, error: undefined }));
      
      // Join document room
      setState(prev => ({ ...prev, isJoining: true }));
      socket.emit('join-document', { documentId, token });
    });

    socket.on('disconnect', (reason) => {
      // // // console.log('Socket disconnected:', reason);
      setState(prev => ({
        ...prev,
        isConnected: false,
        collaborators: [],
        cursors: {},
        currentUser: undefined,
      }));

      // Attempt to reconnect after a delay
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, don't reconnect
        return;
      }

      reconnectTimeoutRef.current = setTimeout(() => {
        socket.connect();
      }, 3000);
    });

    // Document collaboration event handlers
    socket.on('document-joined', (data: {
      documentState: DocumentState;
      activeUsers: CollaborationUser[];
      user: CollaborationUser;
    }) => {
      // // // console.log('Joined document successfully');
      setState(prev => ({
        ...prev,
        isJoining: false,
        documentState: data.documentState,
        collaborators: data.activeUsers,
        currentUser: data.user,
      }));

      if (onContentUpdate) {
        onContentUpdate(data.documentState.content);
      }
    });

    socket.on('user-joined', (user: CollaborationUser) => {
      // // // console.log('User joined:', user.name);
      setState(prev => ({
        ...prev,
        collaborators: [...prev.collaborators, user],
      }));
    });

    socket.on('user-left', (userId: string) => {
      // // // console.log('User left:', userId);
      setState(prev => ({
        ...prev,
        collaborators: prev.collaborators.filter(u => u.id !== userId),
        cursors: Object.fromEntries(
          Object.entries(prev.cursors).filter(([id]) => id !== userId)
        ),
      }));
    });

    socket.on('document-change', (change: DocumentChange) => {
      // // // console.log('Document change received:', change);
      if (onDocumentChange) {
        onDocumentChange(change);
      }
    });

    socket.on('cursor-position', (position: CursorPosition) => {
      setState(prev => ({
        ...prev,
        cursors: {
          ...prev.cursors,
          [position.userId]: position,
        },
      }));
    });

    // Error handling
    socket.on('error', (error: { message: string }) => {
      console.error('Socket error:', error);
      const errorMessage = error.message || 'Connection error';
      setState(prev => ({ ...prev, _error: errorMessage, isJoining: false }));
      
      if (onError) {
        onError(errorMessage);
      }
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      const errorMessage = 'Failed to connect to collaboration server';
      setState(prev => ({ ...prev, _error: errorMessage, isJoining: false }));
      
      if (onError) {
        onError(errorMessage);
      }
    });

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      socket.disconnect();
    };
  }, [documentId, token, onDocumentChange, onContentUpdate, onError]);

  // Send document change
  const sendDocumentChange = useCallback((change: Omit<DocumentChange, 'id' | 'timestamp' | 'author'>) => {
    if (!socketRef.current?.connected) {
      // // // console.warn('Socket not connected, cannot send document change');
      return;
    }

    const fullChange: DocumentChange = {
      ...change,
      id: `change_${Date.now()}_${Math.random()}`,
      timestamp: new Date(),
      author: state.currentUser?.id || 'unknown',
    };

    socketRef.current.emit('document-change', fullChange);
  }, [state.currentUser?.id]);

  // Send cursor position
  const sendCursorPosition = useCallback((position: { line: number; character: number }) => {
    if (!socketRef.current?.connected || !state.currentUser) {
      return;
    }

    const cursorPosition: CursorPosition = {
      userId: state.currentUser.id,
      documentId,
      line: position.line,
      character: position.character,
      timestamp: new Date(),
    };

    socketRef.current.emit('cursor-position', cursorPosition);
  }, [documentId, state.currentUser]);

  // Disconnect from collaboration
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
  }, []);

  // Retry connection
  const retry = useCallback(() => {
    if (socketRef.current) {
      setState(prev => ({ ...prev, error: undefined }));
      socketRef.current.connect();
    }
  }, []);

  return {
    ...state,
    sendDocumentChange,
    sendCursorPosition,
    disconnect,
    retry,
  };
};

// Operational Transform utility for client-side
export class ClientOperationalTransform {
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

  static createInsertOperation(
    position: number,
    content: string,
    documentId: string
  ): Omit<DocumentChange, 'id' | 'timestamp' | 'author'> {
    return {
      type: 'insert',
      position,
      content,
      documentId,
    };
  }

  static createDeleteOperation(
    position: number,
    length: number,
    documentId: string
  ): Omit<DocumentChange, 'id' | 'timestamp' | 'author'> {
    return {
      type: 'delete',
      position,
      length,
      documentId,
    };
  }
}