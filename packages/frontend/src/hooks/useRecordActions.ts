import { useState } from 'react';
import { useToast } from '../contexts';
import { useDeleteRecordMutation, useUpdateRecordMutation } from './relay';
import type { Record } from '../components/RecordCard';
import type { RecordUpdates } from '../components/RecordEditModal';

/**
 * Shared edit/delete logic for any page that renders a list of RecordCards.
 * Caller must pass a `refetch` callback that re-runs the underlying query.
 */
export function useRecordActions(refetch: () => void) {
  const { addToast } = useToast();
  const [editingRecord, setEditingRecord] = useState<Record | null>(null);

  const { mutate: deleteRecord, isLoading: isDeleting } = useDeleteRecordMutation();
  const { mutate: updateRecord, isLoading: isUpdating } = useUpdateRecordMutation();

  const isLoading = isDeleting || isUpdating;

  const handleEdit = (record: Record) => setEditingRecord(record);
  const handleCancelEdit = () => setEditingRecord(null);

  const handleDelete = async (record: Record) => {
    try {
      await deleteRecord({ id: record.id }, refetch);
      addToast('Record deleted successfully', 'success');
    } catch (err: any) {
      addToast(err?.message ?? 'Failed to delete record', 'error');
    }
  };

  const handleSaveEdit = async (updates: RecordUpdates) => {
    if (!editingRecord) return;
    try {
      await updateRecord({ id: editingRecord.id, ...updates }, refetch);
      addToast('Record updated successfully', 'success');
      setEditingRecord(null);
    } catch (err: any) {
      throw new Error(err?.message ?? 'Failed to update record');
    }
  };

  return {
    editingRecord,
    isLoading,
    handleEdit,
    handleDelete,
    handleSaveEdit,
    handleCancelEdit,
  };
}
