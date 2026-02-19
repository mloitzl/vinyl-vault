import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrackList } from './TrackList';

describe('TrackList', () => {
  it('renders track list heading with count', () => {
    const tracks = [
      { position: '1', title: 'Song 1', duration: '3:45' },
      { position: '2', title: 'Song 2', duration: '4:12' },
    ];

    render(<TrackList tracks={tracks} />);

    expect(screen.getByText(/tracks \(2\)/i)).toBeInTheDocument();
  });

  it('renders all tracks with title and duration', () => {
    const tracks = [
      { position: '1', title: 'Song 1', duration: '3:45' },
      { position: '2', title: 'Song 2', duration: '4:12' },
    ];

    render(<TrackList tracks={tracks} />);

    expect(screen.getByText('Song 1')).toBeInTheDocument();
    expect(screen.getByText('Song 2')).toBeInTheDocument();
    expect(screen.getByText('3:45')).toBeInTheDocument();
    expect(screen.getByText('4:12')).toBeInTheDocument();
  });

  it('uses track position when available', () => {
    const tracks = [
      { position: 'A1', title: 'Song 1' },
      { position: 'B1', title: 'Song 2' },
    ];

    render(<TrackList tracks={tracks} />);

    expect(screen.getByText('A1')).toBeInTheDocument();
    expect(screen.getByText('B1')).toBeInTheDocument();
  });

  it('uses index when position is not provided', () => {
    const tracks = [{ title: 'Song 1' }, { title: 'Song 2' }];

    const { container } = render(<TrackList tracks={tracks} />);

    // Check that indices are used (1, 2)
    const positionElements = container.querySelectorAll('.w-8.text-gray-400.text-xs');
    expect(positionElements.length).toBe(2);
  });

  it('handles tracks without duration', () => {
    const tracks = [{ position: '1', title: 'Song 1' }];

    const { container } = render(<TrackList tracks={tracks} />);

    expect(screen.getByText('Song 1')).toBeInTheDocument();
    // Duration element should not exist
    const durationElements = container.querySelectorAll('.text-gray-400.text-xs.ml-2');
    expect(durationElements.length).toBe(0);
  });

  it('returns null when tracks array is empty', () => {
    const { container } = render(<TrackList tracks={[]} />);

    expect(container.firstChild).toBeNull();
  });

  it('returns null when tracks prop is undefined', () => {
    const { container } = render(<TrackList tracks={undefined as any} />);

    expect(container.firstChild).toBeNull();
  });

  it('filters out tracks with missing or empty titles', () => {
    const tracks = [
      { position: '1', title: 'Song 1', duration: '3:45' },
      { position: '2', title: '', duration: '4:12' },
      { position: '3', title: undefined as unknown as string },
    ];

    render(<TrackList tracks={tracks} />);

    expect(screen.getByText(/tracks \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText('Song 1')).toBeInTheDocument();
  });

  it('returns null when all tracks have missing titles', () => {
    const tracks = [
      { title: '' },
      { title: undefined as unknown as string },
    ];

    const { container } = render(<TrackList tracks={tracks} />);

    expect(container.firstChild).toBeNull();
  });


  it('truncates long song titles', () => {
    const tracks = [
      {
        position: '1',
        title: 'This is a very long song title that should be truncated to prevent layout issues',
        duration: '5:30',
      },
    ];

    const { container } = render(<TrackList tracks={tracks} />);

    const titleElement = container.querySelector('.truncate.text-gray-700');
    expect(titleElement).toHaveClass('truncate');
  });
});
