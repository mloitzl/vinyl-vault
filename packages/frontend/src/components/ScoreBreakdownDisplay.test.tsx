import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScoreBreakdownDisplay } from './ScoreBreakdownDisplay';

describe('ScoreBreakdownDisplay', () => {
  it('renders score breakdown labels and values', () => {
    const breakdown = {
      mediaType: 10,
      countryPreference: 5,
      trackListCompleteness: 8,
      coverArt: 3,
      labelInfo: -2,
      catalogNumber: 0,
      yearInfo: 4,
      sourceBonus: 2,
    };

    render(<ScoreBreakdownDisplay breakdown={breakdown} />);

    expect(screen.getByText(/score breakdown/i)).toBeInTheDocument();
    expect(screen.getByText(/media/i)).toBeInTheDocument();
    expect(screen.getByText(/country/i)).toBeInTheDocument();
    expect(screen.getByText(/tracks/i)).toBeInTheDocument();
    expect(screen.getByText(/cover/i)).toBeInTheDocument();
    expect(screen.getByText(/label/i)).toBeInTheDocument();
    expect(screen.getByText(/year/i)).toBeInTheDocument();
  });

  it('displays positive values with plus sign', () => {
    const breakdown = {
      mediaType: 10,
      countryPreference: 0,
      trackListCompleteness: 0,
      coverArt: 0,
      labelInfo: 0,
      catalogNumber: 0,
      yearInfo: 0,
      sourceBonus: 0,
    };

    render(<ScoreBreakdownDisplay breakdown={breakdown} />);

    expect(screen.getByText('+10')).toBeInTheDocument();
  });

  it('displays negative values without plus sign', () => {
    const breakdown = {
      mediaType: 0,
      countryPreference: 0,
      trackListCompleteness: 0,
      coverArt: 0,
      labelInfo: -2,
      catalogNumber: 0,
      yearInfo: 0,
      sourceBonus: 0,
    };

    render(<ScoreBreakdownDisplay breakdown={breakdown} />);

    expect(screen.getByText('-2')).toBeInTheDocument();
  });

  it('filters out items with zero value', () => {
    const breakdown = {
      mediaType: 10,
      countryPreference: 0,
      trackListCompleteness: 0,
      coverArt: 0,
      labelInfo: 0,
      catalogNumber: 0,
      yearInfo: 0,
      sourceBonus: 0,
    };

    render(<ScoreBreakdownDisplay breakdown={breakdown} />);

    // Should only show Media badge
    const badges = screen.getAllByText(/\+10|-2|Media|Country|Tracks|Cover|Label|Year/i);
    expect(badges.length).toBeGreaterThan(0);
    expect(screen.getByText(/media/i)).toBeInTheDocument();
  });

  it('applies positive styling to positive values', () => {
    const breakdown = {
      mediaType: 10,
      countryPreference: 0,
      trackListCompleteness: 0,
      coverArt: 0,
      labelInfo: 0,
      catalogNumber: 0,
      yearInfo: 0,
      sourceBonus: 0,
    };

    const { container } = render(<ScoreBreakdownDisplay breakdown={breakdown} />);

    const badge = container.querySelector('.bg-emerald-50');
    expect(badge).toBeInTheDocument();
  });

  it('applies negative styling to negative values', () => {
    const breakdown = {
      mediaType: 0,
      countryPreference: 0,
      trackListCompleteness: 0,
      coverArt: 0,
      labelInfo: -2,
      catalogNumber: 0,
      yearInfo: 0,
      sourceBonus: 0,
    };

    const { container } = render(<ScoreBreakdownDisplay breakdown={breakdown} />);

    const badge = container.querySelector('.bg-red-50');
    expect(badge).toBeInTheDocument();
  });

  it('returns null when no items have non-zero values', () => {
    const breakdown = {
      mediaType: 0,
      countryPreference: 0,
      trackListCompleteness: 0,
      coverArt: 0,
      labelInfo: 0,
      catalogNumber: 0,
      yearInfo: 0,
      sourceBonus: 0,
    };

    const { container } = render(<ScoreBreakdownDisplay breakdown={breakdown} />);

    // Component should render nothing (null)
    expect(container.innerHTML).toBe('');
  });
});
