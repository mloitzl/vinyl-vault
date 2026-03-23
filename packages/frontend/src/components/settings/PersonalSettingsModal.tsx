import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Modal } from '../ui/Modal';
import { useUpdateUserSettingsMutation } from '../../hooks/relay/useUpdateUserSettingsMutation.js';

interface PersonalSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PersonalSettingsModal({ isOpen, onClose }: PersonalSettingsModalProps) {
  const { user, refreshUser } = useAuth();
  const { mutate: updateSettings, isLoading: saving } = useUpdateUserSettingsMutation();
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const handleToggle = async (field: 'spotifyPreview' | 'allowFriendInvites', enabled: boolean) => {
    setError(null);
    try {
      await updateSettings({ [field]: enabled });
      await refreshUser();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
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
          <ToggleRow
            label="Spotify Track Previews"
            description="Show play buttons next to tracks to listen to 30-second previews"
            checked={user.settings.spotifyPreview}
            disabled={saving}
            onChange={(v) => handleToggle('spotifyPreview', v)}
            activeColor="bg-[#1DB954]"
          />

          {/* Allow Friend Requests */}
          <ToggleRow
            label="Allow friend requests"
            description="Let other users find you by username or email and send friend requests"
            checked={user.settings.allowFriendInvites}
            disabled={saving}
            onChange={(v) => handleToggle('allowFriendInvites', v)}
            activeColor="bg-emerald-600"
          />

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      </div>
    </Modal>
  );
}

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
  activeColor: string;
}

function ToggleRow({ label, description, checked, disabled, onChange, activeColor }: ToggleRowProps) {
  return (
    <label className="flex items-start justify-between gap-4 cursor-pointer">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <div className="relative flex-shrink-0 mt-0.5">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div
          className={`w-10 h-6 rounded-full transition-colors ${
            checked ? activeColor : 'bg-gray-200'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div
            className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
              checked ? 'translate-x-5' : 'translate-x-1'
            }`}
          />
        </div>
      </div>
    </label>
  );
}
