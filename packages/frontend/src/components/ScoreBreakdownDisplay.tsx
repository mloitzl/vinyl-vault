interface ScoreBreakdown {
  mediaType: number;
  countryPreference: number;
  trackListCompleteness: number;
  coverArt: number;
  labelInfo: number;
  catalogNumber: number;
  yearInfo: number;
  sourceBonus: number;
}

interface ScoreBreakdownDisplayProps {
  breakdown: ScoreBreakdown;
}

export function ScoreBreakdownDisplay({ breakdown }: ScoreBreakdownDisplayProps) {
  const items = [
    { label: 'Media', value: breakdown.mediaType },
    { label: 'Country', value: breakdown.countryPreference },
    { label: 'Tracks', value: breakdown.trackListCompleteness },
    { label: 'Cover', value: breakdown.coverArt },
    { label: 'Label', value: breakdown.labelInfo },
    { label: 'Year', value: breakdown.yearInfo },
  ].filter((item) => item.value !== 0);

  if (items.length === 0) return null;

  return (
    <div>
      <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
        Score Breakdown
      </h4>
      <div className="flex flex-wrap gap-2">
        {items.map((item, i) => (
          <span
            key={i}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
              item.value > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
            }`}
          >
            <span className="text-gray-500">{item.label}</span>
            <span className="font-medium">
              {item.value > 0 ? '+' : ''}
              {item.value}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default ScoreBreakdownDisplay;
