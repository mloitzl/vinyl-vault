import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Modal } from '../ui/Modal';
import { executeGraphQLMutation } from '../../utils/graphqlExecutor.js';

interface PersonalSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const UPDATE_SETTINGS_MUTATION = `
  mutation UpdateUserSettings($input: UpdateUserSettingsInput!) {
    updateUserSettings(input: $input) {
      id
      settings {
        spotifyPreview
      }
    }
  }
`;

export function PersonalSettingsModal({ isOpen, onClose }: PersonalSettingsModalProps) {
  const { user, refreshUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const handleSpotifyToggle = async (enabled: boolean) => {
    setSaving(true);
    setError(null);
    try {
      await executeGraphQLMutation(UPDATE_SETTINGS_MUTATION, { input: { spotifyPreview: enabled } });
      await refreshUser();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} title="Personal Settings" onClose={onClose} size="sm">
      <div className="space-y-4">
        {/* Profile */}
        <div className="flex items-center gap-4">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.displayName}
              className="w-16 h-16 rounded-full ring-2 ring-gray-200"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gray-300 flex items-center justify-center">
              <span className="text-gray-600 text-xl font-medium">
                {user.displayName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <p className="font-semibold text-gray-900">{user.displayName}</p>
            <p className="text-sm text-gray-500">@{user.githubLogin}</p>
          </div>
        </div>

        {/* Settings */}
        <div className="border-t border-gray-100 pt-4 space-y-3">
          <h3 className="text-sm font-medium text-gray-700">Preferences</h3>

          {/* Spotify Preview Toggle */}
          <label className="flex items-start justify-between gap-4 cursor-pointer">
            <div>
              <p className="text-sm font-medium text-gray-800">Spotify Track Previews</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Show play buttons next to tracks to listen to 30-second previews
              </p>
            </div>
            <div className="relative flex-shrink-0 mt-0.5">
              <input
                type="checkbox"
                className="sr-only"
                checked={user.settings.spotifyPreview}
                disabled={saving}
                onChange={(e) => handleSpotifyToggle(e.target.checked)}
              />
              <div
                className={`w-10 h-6 rounded-full transition-colors ${
                  user.settings.spotifyPreview ? 'bg-[#1DB954]' : 'bg-gray-200'
                } ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    user.settings.spotifyPreview ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </div>
            </div>
          </label>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      </div>
    </Modal>
  );
}
