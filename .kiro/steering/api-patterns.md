# API Integration Patterns

## API Client Standards

### Service Layer Architecture

- Centralize API calls in `services/` directory
- Use axios for HTTP requests with proper configuration
- Implement request/response interceptors for common logic
- Create typed API response interfaces

### Error Handling Patterns

```typescript
// Standard API response wrapper
interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  errors?: string[];
}

// Error handling in services
try {
  const response = await apiClient.get<ApiResponse<User>>('/users');
  return response.data;
} catch (error) {
  if (axios.isAxiosError(error)) {
    throw new ApiError(error.response?.data?.message || 'Request failed');
  }
  throw error;
}
```

### Request Configuration

- Use environment variables for API base URLs
- Implement proper timeout configurations
- Add authentication headers consistently
- Use request cancellation for cleanup

### Data Fetching Patterns

- Use React Query or SWR for server state management
- Implement proper loading and error states
- Cache responses appropriately
- Handle race conditions and stale data

## WebSocket Integration

- Use Socket.IO client for real-time features
- Implement connection state management
- Handle reconnection logic
- Clean up listeners on component unmount

## Authentication Flow

- Store tokens securely (httpOnly cookies preferred)
- Implement token refresh logic
- Handle authentication errors globally
- Redirect to login on 401 responses
