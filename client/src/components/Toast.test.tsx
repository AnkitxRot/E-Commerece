import { render, screen } from '@testing-library/react';
import { act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ToastProvider, useToast } from '../context/ToastContext.js';
import { Toast } from './Toast.js';

function Trigger() {
  const { show } = useToast();
  return <button onClick={() => show('Saved successfully')}>trigger</button>;
}

describe('Toast', () => {
  it('renders a message pushed via useToast', async () => {
    render(
      <ToastProvider>
        <Trigger />
        <Toast />
      </ToastProvider>,
    );
    await act(async () => screen.getByText('trigger').click());
    expect(screen.getByText('Saved successfully')).toBeInTheDocument();
  });
});
