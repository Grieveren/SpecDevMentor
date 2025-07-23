# Real-Time Collaboration Patterns

## WebSocket/Socket.IO Architecture

### Server-Side Socket Management

```typescript
// Socket.IO server setup with room-based collaboration
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';

interface CollaborationServer {
  io: Server;
  documentRooms: Map<string, DocumentRoom>;
  userSessions: Map<string, UserSession>;
}

class DocumentCollaborationService {
  private io: Server;
  private redis: Redis;
  
  constructor(server: http.Server, redis: Redis) {
    this.io = new Server(server, {
      cors: { origin: process.env.CLIENT_URL },
      transports: ['websocket', 'polling']
    });
    
    // Use Redis adapter for horizontal scaling
    this.io.adapter(createAdapter(redis, redis.duplicate()));
    
    this.setupEventHandlers();
  }
  
  private setupEventHandlers() {
    this.io.on('connection', (socket) => {
      socket.on('join-document', this.handleJoinDocument.bind(this, socket));
      socket.on('document-change', this.handleDocumentChange.bind(this, socket));
      socket.on('cursor-position', this.handleCursorPosition.bind(this, socket));
      socket.on('user-selection', this.handleUserSelection.bind(this, socket));
      socket.on('disconnect', this.handleDisconnect.bind(this, socket));
    });
  }
  
  private async handleJoinDocument(socket: Socket, data: JoinDocumentRequest) {
    const { documentId, userId } = data;
    
    // Validate user permissions
    const hasAccess = await this.validateDocumentAccess(userId, documentId);
    if (!hasAccess) {
      socket.emit('error', { message: 'Access denied' });
      return;
    }
    
    // Join document room
    await socket.join(`doc:${documentId}`);
    
    // Track user session
    this.userSessions.set(socket.id, {
      userId,
      documentId,
      joinedAt: new Date(),
      lastActivity: new Date()
    });
    
    // Notify other users
    socket.to(`doc:${documentId}`).emit('user-joined', {
      userId,
      user: await this.getUserInfo(userId)
    });
    
    // Send current document state and active users
    const documentState = await this.getDocumentState(documentId);
    const activeUsers = await this.getActiveUsers(documentId);
    
    socket.emit('document-state', { documentState, activeUsers });
  }
}
```

### Operational Transformation (OT)

```typescript
// Operational Transformation for concurrent editing
interface Operation {
  type: 'insert' | 'delete' | 'retain';
  position: number;
  content?: string;
  length?: number;
  author: string;
  timestamp: Date;
}

class OperationalTransform {
  // Transform operation against another operation
  static transform(op1: Operation, op2: Operation): [Operation, Operation] {
    if (op1.type === 'insert' && op2.type === 'insert') {
      if (op1.position <= op2.position) {
        return [op1, { ...op2, position: op2.position + (op1.content?.length || 0) }];
      } else {
        return [{ ...op1, position: op1.position + (op2.content?.length || 0) }, op2];
      }
    }
    
    if (op1.type === 'delete' && op2.type === 'delete') {
      if (op1.position <= op2.position) {
        return [op1, { ...op2, position: Math.max(op2.position - (op1.length || 0), op1.position) }];
      } else {
        return [{ ...op1, position: op1.position - Math.min(op2.length || 0, op1.position - op2.position) }, op2];
      }
    }
    
    // Handle insert vs delete and other combinations
    return this.transformMixed(op1, op2);
  }
  
  // Apply operation to document content
  static apply(content: string, operation: Operation): string {
    switch (operation.type) {
      case 'insert':
        return content.slice(0, operation.position) + 
               (operation.content || '') + 
               content.slice(operation.position);
      
      case 'delete':
        return content.slice(0, operation.position) + 
               content.slice(operation.position + (operation.length || 0));
      
      default:
        return content;
    }
  }
}
```

### Conflict Resolution

```typescript
// Conflict detection and resolution
interface EditConflict {
  id: string;
  documentId: string;
  conflictingOperations: Operation[];
  affectedRange: { start: number; end: number };
  users: string[];
  timestamp: Date;
}

class ConflictResolver {
  async detectConflicts(operations: Operation[]): Promise<EditConflict[]> {
    const conflicts: EditConflict[] = [];
    
    // Group operations by overlapping ranges
    for (let i = 0; i < operations.length; i++) {
      for (let j = i + 1; j < operations.length; j++) {
        const op1 = operations[i];
        const op2 = operations[j];
        
        if (this.operationsOverlap(op1, op2)) {
          conflicts.push({
            id: generateId(),
            documentId: op1.documentId,
            conflictingOperations: [op1, op2],
            affectedRange: this.getAffectedRange(op1, op2),
            users: [op1.author, op2.author],
            timestamp: new Date()
          });
        }
      }
    }
    
    return conflicts;
  }
  
  async resolveConflict(conflict: EditConflict, resolution: ConflictResolution): Promise<Operation[]> {
    switch (resolution.strategy) {
      case 'last-writer-wins':
        return [conflict.conflictingOperations.sort((a, b) => 
          b.timestamp.getTime() - a.timestamp.getTime())[0]];
      
      case 'merge':
        return this.mergeOperations(conflict.conflictingOperations);
      
      case 'manual':
        return resolution.manualOperations || [];
      
      default:
        throw new Error(`Unknown resolution strategy: ${resolution.strategy}`);
    }
  }
}
```

## Frontend Collaboration Components

### Real-Time Editor Integration

```typescript
// React hook for collaborative editing
const useCollaborativeEditor = (documentId: string, initialContent: string) => {
  const [content, setContent] = useState(initialContent);
  const [collaborators, setCollaborators] = useState<CollaborationUser[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  useEffect(() => {
    const newSocket = io(process.env.REACT_APP_WS_URL);
    setSocket(newSocket);
    
    newSocket.on('connect', () => {
      setIsConnected(true);
      newSocket.emit('join-document', { documentId, userId: currentUser.id });
    });
    
    newSocket.on('document-change', (operation: Operation) => {
      if (operation.author !== currentUser.id) {
        setContent(prev => OperationalTransform.apply(prev, operation));
      }
    });
    
    newSocket.on('user-joined', (user: CollaborationUser) => {
      setCollaborators(prev => [...prev, user]);
    });
    
    newSocket.on('user-left', (userId: string) => {
      setCollaborators(prev => prev.filter(u => u.id !== userId));
    });
    
    newSocket.on('cursor-position', (data: CursorPosition) => {
      // Update cursor positions for other users
    });
    
    return () => {
      newSocket.disconnect();
    };
  }, [documentId]);
  
  const handleContentChange = useCallback((newContent: string, change: ContentChange) => {
    setContent(newContent);
    
    if (socket && isConnected) {
      const operation: Operation = {
        type: change.type,
        position: change.position,
        content: change.content,
        length: change.length,
        author: currentUser.id,
        timestamp: new Date()
      };
      
      socket.emit('document-change', operation);
    }
  }, [socket, isConnected]);
  
  return {
    content,
    collaborators,
    isConnected,
    handleContentChange
  };
};
```

### User Presence Indicators

```typescript
// Component for showing active collaborators
const CollaborationIndicator: React.FC<{
  collaborators: CollaborationUser[];
  maxVisible?: number;
}> = ({ collaborators, maxVisible = 3 }) => {
  const visibleUsers = collaborators.slice(0, maxVisible);
  const hiddenCount = Math.max(0, collaborators.length - maxVisible);
  
  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm text-gray-600">
        {collaborators.length > 0 ? `${collaborators.length} active` : 'No one else'}
      </span>
      
      <div className="flex -space-x-2">
        {visibleUsers.map(user => (
          <div
            key={user.id}
            className="w-8 h-8 rounded-full border-2 border-white bg-gray-300 flex items-center justify-center text-xs font-medium"
            style={{ backgroundColor: user.color }}
            title={user.name}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
        ))}
        
        {hiddenCount > 0 && (
          <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-400 flex items-center justify-center text-xs font-medium text-white">
            +{hiddenCount}
          </div>
        )}
      </div>
    </div>
  );
};

// Cursor tracking component
const CollaborativeCursors: React.FC<{
  cursors: Record<string, CursorPosition>;
  users: Record<string, CollaborationUser>;
}> = ({ cursors, users }) => {
  return (
    <>
      {Object.entries(cursors).map(([userId, position]) => {
        const user = users[userId];
        if (!user) return null;
        
        return (
          <div
            key={userId}
            className="absolute pointer-events-none z-10"
            style={{
              left: position.x,
              top: position.y,
              borderLeft: `2px solid ${user.color}`
            }}
          >
            <div
              className="px-2 py-1 text-xs text-white rounded-md -mt-6 whitespace-nowrap"
              style={{ backgroundColor: user.color }}
            >
              {user.name}
            </div>
          </div>
        );
      })}
    </>
  );
};
```

## Comment and Review System

### Threaded Comments

```typescript
// Comment thread management
interface CommentThread {
  id: string;
  documentId: string;
  position: { line: number; character: number };
  comments: Comment[];
  status: 'open' | 'resolved';
  createdAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
}

interface Comment {
  id: string;
  threadId: string;
  author: User;
  content: string;
  createdAt: Date;
  editedAt?: Date;
  reactions: Reaction[];
}

// Comment component
const CommentThread: React.FC<{
  thread: CommentThread;
  onReply: (content: string) => void;
  onResolve: () => void;
  onReopen: () => void;
  canModerate: boolean;
}> = ({ thread, onReply, onResolve, onReopen, canModerate }) => {
  const [replyContent, setReplyContent] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  
  return (
    <div className="bg-white border rounded-lg shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className={cn(
            "w-2 h-2 rounded-full",
            thread.status === 'open' ? "bg-yellow-400" : "bg-green-400"
          )} />
          <span className="text-sm font-medium">
            {thread.status === 'open' ? 'Open' : 'Resolved'}
          </span>
        </div>
        
        {canModerate && (
          <button
            onClick={thread.status === 'open' ? onResolve : onReopen}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {thread.status === 'open' ? 'Resolve' : 'Reopen'}
          </button>
        )}
      </div>
      
      <div className="space-y-3">
        {thread.comments.map(comment => (
          <CommentItem key={comment.id} comment={comment} />
        ))}
      </div>
      
      {thread.status === 'open' && (
        <div className="mt-4 pt-4 border-t">
          {isReplying ? (
            <div className="space-y-2">
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Write a reply..."
                className="w-full p-2 border rounded-md resize-none"
                rows={3}
              />
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setIsReplying(false)}
                  className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onReply(replyContent);
                    setReplyContent('');
                    setIsReplying(false);
                  }}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Reply
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsReplying(true)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Reply
            </button>
          )}
        </div>
      )}
    </div>
  );
};
```

## Performance Optimization

### Connection Management

```typescript
// Connection pooling and optimization
class CollaborationConnectionManager {
  private connections: Map<string, Socket> = new Map();
  private heartbeatInterval: NodeJS.Timeout;
  
  constructor() {
    // Send heartbeat every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 30000);
  }
  
  private sendHeartbeat() {
    this.connections.forEach((socket, userId) => {
      socket.emit('ping', { timestamp: Date.now() });
    });
  }
  
  // Cleanup inactive connections
  private cleanupInactiveConnections() {
    const now = Date.now();
    const timeout = 5 * 60 * 1000; // 5 minutes
    
    this.connections.forEach((socket, userId) => {
      const session = this.userSessions.get(socket.id);
      if (session && now - session.lastActivity.getTime() > timeout) {
        socket.disconnect();
        this.connections.delete(userId);
      }
    });
  }
}

// Debounced operations to reduce server load
const useDebouncedOperation = (operation: Function, delay: number = 500) => {
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  return useCallback((...args: any[]) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      operation(...args);
    }, delay);
  }, [operation, delay]);
};
```