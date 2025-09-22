import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from '../pages/app';

const renderApp = () => {
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <App />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.endsWith('/api/v1/projects')) {
      return Promise.resolve(
        new Response(
          JSON.stringify({ data: [{ id: '1', name: 'Demo', description: '', createdAt: new Date().toISOString() }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
    }
    if (url.endsWith('/api/v1/projects/1')) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: {
              id: '1',
              name: 'Demo',
              description: '',
              createdAt: new Date().toISOString(),
              workflow: {
                currentPhase: 'requirements',
                completedPhases: [],
                pendingApproval: false,
                progressPercentage: 0
              },
              documents: []
            }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
    }
    return Promise.resolve(new Response('Not found', { status: 404 }));
  });
});

describe('App shell', () => {
  it('renders heading', async () => {
    renderApp();
    expect(screen.getByText('CodeMentor AI')).toBeInTheDocument();
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });
});
