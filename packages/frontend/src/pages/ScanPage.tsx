import { ScanBarcode } from '../components';
import { useAuth } from '../contexts/AuthContext';

interface ScanPageProps {
  onRecordAdded?: () => void;
}

export function ScanPage({ onRecordAdded }: ScanPageProps) {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <p className="text-gray-500">Please sign in to scan barcodes</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-4 py-3 border-b border-gray-200 bg-white">
        <h1 className="text-lg font-semibold text-gray-900">Scan Barcode</h1>
        <p className="text-sm text-gray-500">Add a record to your collection</p>
      </div>
      <div className="flex-1 overflow-auto bg-gray-50">
        <ScanBarcode onRecordAdded={onRecordAdded} />
      </div>
    </div>
  );
}
