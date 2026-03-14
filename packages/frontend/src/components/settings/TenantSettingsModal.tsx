import { useAuth } from '../../contexts/AuthContext';
import { getRoleColors, getRoleLabel } from '../../constants/roles';
import { Modal } from '../ui/Modal';

interface TenantSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TenantSettingsModal({ isOpen, onClose }: TenantSettingsModalProps) {
  const { activeTenant } = useAuth();

  if (!activeTenant) return null;

  return (
    <Modal isOpen={isOpen} title="Tenant Settings" onClose={onClose} size="sm">
      <div className="space-y-4">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Tenant</p>
          <p className="font-semibold text-gray-900">{activeTenant.name}</p>
          <span className="inline-flex mt-1 text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
            {activeTenant.type}
          </span>
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            Your Role
          </p>
          <span
            className={`inline-flex text-xs px-2 py-0.5 rounded font-medium ${getRoleColors(activeTenant.role)}`}
          >
            {getRoleLabel(activeTenant.role)}
          </span>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <p className="text-sm text-gray-400 italic">Member management coming soon.</p>
        </div>
      </div>
    </Modal>
  );
}
