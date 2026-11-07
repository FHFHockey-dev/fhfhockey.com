import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ auth: { user: null as null | { id: string; role: string }, isLoading: false, isRoleLoading: false } }));
vi.mock('contexts/AuthProviderContext', () => ({ useAuth: () => state.auth }));
vi.mock('components/Layout/Container', () => ({ default: ({children}: {children: React.ReactNode}) => <>{children}</> }));
vi.mock('next-seo', () => ({ NextSeo: () => null }));
vi.mock('components/player-cards/PlayerCardShareStudio', () => ({ default: () => <p>Mounted player composer</p> }));
import Page, { getServerSideProps } from '../../../../web/pages/social-share/player-cards';
afterEach(cleanup);
it('uses the real suite gate before mounting the player composer for unauthenticated and non-editor users', () => {
  state.auth = { user: null, isLoading: false, isRoleLoading: false };
  const { rerender } = render(<Page />); expect(screen.queryByText('Mounted player composer')).toBeNull();
  state.auth.user = { id: 'fixture', role: 'user' }; rerender(<Page />); expect(screen.queryByText('Mounted player composer')).toBeNull();
  state.auth.user = { id: 'fixture', role: 'social_editor' }; rerender(<Page />); expect(screen.getByText('Mounted player composer')).toBeTruthy();
});
it('adds private/no-store and noindex headers without a data/provider read', async () => {
  const setHeader = vi.fn();
  const response = await getServerSideProps({ res: { setHeader } } as never);
  expect(response).toEqual({ props: {} }); expect(setHeader).toHaveBeenCalledWith('X-Robots-Tag', 'noindex, nofollow');
  expect(setHeader.mock.calls.find(([key]) => key === 'Cache-Control')?.[1]).toContain('no-store');
});
