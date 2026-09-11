import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ImageGallery } from './ImageGallery.js';

const images = [
  {
    url: 'https://picsum.photos/seed/nova-0/800/800',
    altText: 'Aurelia Nova over-ear headphones in midnight black',
    position: 0,
  },
  {
    url: 'https://picsum.photos/seed/nova-1/800/800',
    altText: 'Aurelia Nova ear cups and headband',
    position: 1,
  },
];

describe('ImageGallery', () => {
  it('sets fetchpriority="high" on the primary image and leaves loading unset', () => {
    render(<ImageGallery images={images} />);
    const primary = screen.getByRole('img', { name: images[0].altText });
    expect(primary).toHaveAttribute('fetchpriority', 'high');
    expect(primary).not.toHaveAttribute('loading');
  });

  it('changes the primary image when a thumbnail button is pressed', async () => {
    render(<ImageGallery images={images} />);
    expect(screen.getByRole('img', { name: images[0].altText })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: images[1].altText }));
    expect(screen.getByRole('img', { name: images[1].altText })).toBeInTheDocument();
  });
});
