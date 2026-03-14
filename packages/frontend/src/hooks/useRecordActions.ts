import { useState, useMemo, useEffect } from 'react';
import { ConnectionHandler, ROOT_ID } from 'relay-runtime';
import { useToast } from '../contexts';
import { useAuth } from '../contexts/AuthContext';
import { useDeleteRecordMutation, useUpdateRecordMutation } from './relay';
import type { Record } from '../components/RecordCard';
import type { RecordUpdates } from '../components/RecordEditModal';

interface RecordFilter {
  artist?: string;
  genre?: string;
  search?: string;
  location?: string;
  [key: string]: unknown;
}

/**
 * Shared edit/delete logic for any page that renders RecordCards.
 *
 * Pass `filter` to scope the @deleteEdge to the correct @connection in the
 * Relay store (each unique filter creates its own connection entry).
 * Delete removes the edge from the store instantly — no network refetch needed.
 * Update returns all updatable fields so Relay merges them in place.
 */
export function useRecordActions(filter?: RecordFilter) {
  const { activeTenant } = useAuth();
  const { addToast } = useToast();
  const [editingRecord, setEditingRecord] = useState<Record | null>(null);

  // VIEWER role cannot mutate records — returning undefined for handlers causes
  // RecordCard to hide the edit/delete buttons entirely (they're optional props).
  const canMutate = !!activeTenant && activeTenant.role !== 'VIEWER';

  useEffect(() => {
    if (!canMutate && editingRecord) {
      setEditingRecord(null);
    }
  }, [canMutate, editingRecord]);

  const { mutate: deleteRecord, isLoading: isDeleting } = useDeleteRecordMutation();
  const { mutate: updateRecord, isLoading: isUpdating } = useUpdateRecordMutation();

  const isLoading = isDeleting || isUpdating;

  // Compute the Relay connection ID for the active filter.
  // @connection(key: "RecordList_records") stores connections under ROOT_ID,
  // keyed by non-pagination args (i.e. just `filter`).
  const connectionId = useMemo(
    () =>
      ConnectionHandler.getConnectionID(
        ROOT_ID,
        'RecordList_records',
        filter && Object.keys(filter).length > 0 ? { filter } : undefined
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(filter)]
  );

  const handleEdit = (record: Record) => setEditingRecord(record);
  const handleCancelEdit = () => setEditingRecord(null);

  const handleDelete = async (record: Record) => {
    try {
      await deleteRecord({ id: record.id }, [connectionId]);
      addToast('Record deleted successfully', 'success');
    } catch (err: any) {
      addToast(err?.message ?? 'Failed to delete record', 'error');
    }
  };

  const handleSaveEdit = async (updates: RecordUpdates) => {
    if (!canMutate) {
      // Safety check: prevent updates when the user no longer has mutation permissions.
      return;
    }
    if (!editingRecord) return;
    try {
      await updateRecord({ id: editingRecord.id, ...updates });
      addToast('Record updated successfully', 'success');
      setEditingRecord(null);
    } catch (err: any) {
      throw new Error(err?.message ?? 'Failed to update record');
    }
  };

  return {
    editingRecord,
    isLoading,
    handleEdit: canMutate ? handleEdit : undefined,
    handleDelete: canMutate ? handleDelete : undefined,
    handleSaveEdit,
    handleCancelEdit,
  };
}
