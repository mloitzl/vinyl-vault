// Record Edit Modal Component
// Modal dialog for editing personal record attributes using composable UI components

import { useState } from 'react';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Alert } from './ui/Alert';
import type { Record } from './RecordCard';

interface RecordEditModalProps {
  record: Record;
  onSave: (updates: RecordUpdates) => Promise<void>;
  onCancel: () => void;
}

export interface RecordUpdates {
  condition?: string;
  location?: string;
  price?: number;
  purchaseDate?: string;
  notes?: string;
}

const CONDITION_OPTIONS = ['Mint', 'Near Mint', 'Very Good', 'Good', 'Fair', 'Poor'];

export function RecordEditModal({ record, onSave, onCancel }: RecordEditModalProps) {
  const [formData, setFormData] = useState<RecordUpdates>({
    condition: record.condition || '',
    location: record.location || '',
    price: record.price || undefined,
    purchaseDate: record.purchaseDate || '',
    notes: record.notes || '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      // Build updates object with only changed fields
      const updates: RecordUpdates = {};
      if (formData.condition !== record.condition) updates.condition = formData.condition;
      if (formData.location !== record.location) updates.location = formData.location;
      if (formData.price !== record.price) updates.price = formData.price;
      if (formData.purchaseDate !== record.purchaseDate)
        updates.purchaseDate = formData.purchaseDate;
      if (formData.notes !== record.notes) updates.notes = formData.notes;

      await onSave(updates);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to update record');
      setIsSaving(false);
    }
  };

  const modalFooter = (
    <div className="flex gap-3">
      <Button variant="secondary" onClick={onCancel} disabled={isSaving} className="flex-1">
        Cancel
      </Button>
      <Button
        variant="primary"
        type="submit"
        disabled={isSaving}
        className="flex-1"
        form="record-edit-form"
      >
        {isSaving ? 'Saving...' : 'Save Changes'}
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={true}
      title="Edit Record"
      onClose={onCancel}
      footer={modalFooter}
      size="lg"
      closeOnBackdropClick={!isSaving}
    >
      {/* Album preview */}
      <div className="mb-6 flex items-center gap-4">
        {record.release.coverImageUrl && (
          <img
            src={record.release.coverImageUrl}
            alt=""
            className="w-12 h-12 rounded object-cover flex-shrink-0"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm text-gray-600">Editing</p>
          <p className="font-medium text-gray-900 truncate">{record.release.title}</p>
          <p className="text-sm text-gray-500 truncate">{record.release.artist}</p>
        </div>
      </div>

      {/* Form */}
      <form id="record-edit-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Error Display */}
        {error && (
          <Alert type="error" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Condition Select */}
        <div>
          <label htmlFor="condition" className="block text-sm font-medium text-gray-700 mb-1">
            Condition
          </label>
          <select
            id="condition"
            value={formData.condition}
            onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
            disabled={isSaving}
            className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">Not specified</option>
            {CONDITION_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        {/* Location Input */}
        <Input
          label="Location"
          id="location"
          value={formData.location}
          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
          placeholder="e.g., Shelf A, Box 3"
          disabled={isSaving}
          fullWidth
        />

        {/* Price and Purchase Date Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Price"
            id="price"
            type="number"
            value={formData.price ?? ''}
            onChange={(e) =>
              setFormData({
                ...formData,
                price: e.target.value ? parseFloat(e.target.value) : undefined,
              })
            }
            min="0"
            step="0.01"
            placeholder="0.00"
            disabled={isSaving}
            fullWidth
          />

          <Input
            label="Purchase Date"
            id="purchaseDate"
            type="date"
            value={formData.purchaseDate}
            onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
            disabled={isSaving}
            fullWidth
          />
        </div>

        {/* Notes Textarea */}
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={4}
            placeholder="Add any personal notes about this record..."
            disabled={isSaving}
            className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed resize-none"
          />
        </div>
      </form>
    </Modal>
  );
}
