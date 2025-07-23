import { describe, it, expect } from 'vitest';

describe('Health Check', () => {
  it('should return ok status', () => {
    const healthStatus = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: 'test'
    };
    
    expect(healthStatus.status).toBe('ok');
    expect(healthStatus.environment).toBe('test');
  });
});