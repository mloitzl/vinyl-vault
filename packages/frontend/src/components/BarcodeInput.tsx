import { Button } from './ui/Button';
import { Input } from './ui/Input';

interface BarcodeInputProps {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (e?: React.FormEvent) => void;
  isLoading: boolean;
  isScanning: boolean;
  onStartCamera: () => void;
  onStopCamera: () => void;
}

export function BarcodeInput({
  value,
  onValueChange,
  onSubmit,
  isLoading,
  isScanning,
  onStartCamera,
  onStopCamera,
}: BarcodeInputProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Input
        label="Barcode"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder="Enter or scan barcode (e.g. 0123456789012)"
        fullWidth
      />
      <div className="flex gap-2 flex-wrap">
        <Button
          type="submit"
          variant="primary"
          disabled={isLoading}
          className="flex-1 sm:flex-none"
        >
          {isLoading ? 'Searching...' : 'Lookup'}
        </Button>
        <Button
          type="button"
          variant={isScanning ? 'danger' : 'secondary'}
          onClick={() => (isScanning ? onStopCamera() : onStartCamera())}
          className="flex-1 sm:flex-none"
        >
          {isScanning ? 'Stop Camera' : 'Use Camera'}
        </Button>
      </div>
    </form>
  );
}

export default BarcodeInput;
