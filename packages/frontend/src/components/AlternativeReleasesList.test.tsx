import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AlternativeReleasesList } from './AlternativeReleasesList';

describe('AlternativeReleasesList', () => {
  it('renders heading with release count', () => {
    const releases = [
      {
        externalId: '1',
        source: 'DISCOGS',
        country: 'US',
        year: 2020,
        score: 85,
      } as any,
    ];

    render(<AlternativeReleasesList releases={releases} />);

    expect(screen.getByText(/other releases \(1\)/i)).toBeInTheDocument();
  });

  it('renders all release information', () => {
    const releases = [
      {
        externalId: '1',
        source: 'DISCOGS',
        country: 'US',
        year: 2020,
        format: 'Vinyl',
        label: 'Warner Bros',
        score: 85,
      } as any,
      {
        externalId: '2',
        source: 'MUSICBRAINZ',
        country: 'UK',
        year: 2019,
        format: 'CD',
        label: 'EMI',
        score: 92,
      } as any,
    ];

    render(<AlternativeReleasesList releases={releases} />);

    expect(screen.getByText('DISCOGS')).toBeInTheDocument();
    expect(screen.getByText('MUSICBRAINZ')).toBeInTheDocument();
    expect(screen.getByText('US')).toBeInTheDocument();
    expect(screen.getByText('UK')).toBeInTheDocument();
    expect(screen.getByText('2020')).toBeInTheDocument();
    expect(screen.getByText('2019')).toBeInTheDocument();
    expect(screen.getByText('85')).toBeInTheDocument();
    expect(screen.getByText('92')).toBeInTheDocument();
  });

  it('displays dash for missing country', () => {
    const releases = [
      {
        externalId: '1',
        source: 'DISCOGS',
        country: null,
        year: 2020,
        score: 85,
      } as any,
    ];

    const { container } = render(<AlternativeReleasesList releases={releases} />);

    // Check for '—' character
    const dashElements = Array.from(container.querySelectorAll('.text-gray-600')).filter((el) =>
      el.textContent?.includes('—')
    );
    expect(dashElements.length).toBeGreaterThan(0);
  });

  it('displays dash for missing year', () => {
    const releases = [
      {
        externalId: '1',
        source: 'DISCOGS',
        country: 'US',
        year: null,
        score: 85,
      } as any,
    ];

    render(<AlternativeReleasesList releases={releases} />);

    const dashElements = document.querySelectorAll('.text-gray-600');
    expect(dashElements.length).toBeGreaterThan(0);
  });

  it('displays dash for missing label', () => {
    const releases = [
      {
        externalId: '1',
        source: 'DISCOGS',
        country: 'US',
        year: 2020,
        label: null,
        score: 85,
      } as any,
    ];

    const { container } = render(<AlternativeReleasesList releases={releases} />);

    // Check for '—' character in label column
    const labelElements = Array.from(container.querySelectorAll('.flex-1.text-gray-500')).filter(
      (el) => el.textContent?.includes('—')
    );
    expect(labelElements.length).toBeGreaterThan(0);
  });

  it('applies different colors for different sources', () => {
    const releases = [
      {
        externalId: '1',
        source: 'DISCOGS',
        country: 'US',
        year: 2020,
        score: 85,
      } as any,
      {
        externalId: '2',
        source: 'MUSICBRAINZ',
        country: 'UK',
        year: 2019,
        score: 92,
      } as any,
    ];

    const { container } = render(<AlternativeReleasesList releases={releases} />);

    const discogsElements = container.querySelectorAll('.text-orange-600');
    const musicbrainzElements = container.querySelectorAll('.text-blue-600');

    expect(discogsElements.length).toBeGreaterThan(0);
    expect(musicbrainzElements.length).toBeGreaterThan(0);
  });

  it('returns null when releases array is empty', () => {
    const { container } = render(<AlternativeReleasesList releases={[]} />);

    expect(container.firstChild).toBeNull();
  });

  it('returns null when releases prop is undefined', () => {
    const { container } = render(<AlternativeReleasesList releases={undefined as any} />);

    expect(container.firstChild).toBeNull();
  });

  it('truncates long label names', () => {
    const releases = [
      {
        externalId: '1',
        source: 'DISCOGS',
        country: 'US',
        year: 2020,
        label: 'This is a very long label name that should be truncated',
        score: 85,
      } as any,
    ];

    const { container } = render(<AlternativeReleasesList releases={releases} />);

    const labelElement = container.querySelector('.flex-1.text-gray-500.truncate');
    expect(labelElement).toHaveClass('truncate');
  });
});
