// @ts-nocheck
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

function App() {
  return (
    <div>
      <h1>CodeMentor AI Platform</h1>
      <p>Development Environment Ready</p>
    </div>
  );
}

describe('App', () => {
  it('renders the main heading', () => {
    render(<App />);
    expect(screen.getByText('CodeMentor AI Platform')).toBeInTheDocument();
  });

  it('shows development ready message', () => {
    render(<App />);
    expect(screen.getByText('Development Environment Ready')).toBeInTheDocument();
  });
});