import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/index.js';

const app = createApp();

describe('API bootstrap', () => {
  it('exposes health endpoint', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('returns empty project list initially', async () => {
    const response = await request(app).get('/api/v1/projects');
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
  });
});
