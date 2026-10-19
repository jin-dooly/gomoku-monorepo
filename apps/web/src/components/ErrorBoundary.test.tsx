import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { reportError } from '../lib/report';
import { ErrorBoundary } from './ErrorBoundary';

vi.mock('../lib/report', () => ({ reportError: vi.fn() }));

const Broken = () => {
  throw new Error('render failed');
};

describe('ErrorBoundary', () => {
  it('화면을 그리다 오류가 나면 안내와 다시 불러오기 버튼을 보여주고 오류를 보고해요', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('heading', { name: '문제가 생겼어요' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 불러오기' })).toBeInTheDocument();
    expect(reportError).toHaveBeenCalledWith('render', expect.objectContaining({ message: 'render failed' }), expect.anything());
  });
});
