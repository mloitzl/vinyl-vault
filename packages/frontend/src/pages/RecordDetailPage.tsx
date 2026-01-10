import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function RecordDetailPage() {
  const { recordId } = useParams<{ recordId: string }>();
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <p className="text-gray-500">Please sign in to view record details</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-4 py-3 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <Link
            to="/collection"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Back to collection"
          >
            <svg
              className="w-5 h-5 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Record Details</h1>
            <p className="text-sm text-gray-500">ID: {recordId}</p>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-gray-50 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-center text-gray-500">
              <svg
                className="w-16 h-16 mx-auto mb-4 text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                />
              </svg>
              <p className="text-lg font-medium mb-2">Record Detail View</p>
              <p className="text-sm">This page will display full record information</p>
              <p className="text-xs text-gray-400 mt-4">
                Implementation planned for Phase 2 of the frontend refactor
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
