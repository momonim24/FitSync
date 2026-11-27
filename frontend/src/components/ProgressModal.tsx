import { useEffect, useState, type FormEvent } from 'react';
import { getErrorMessage } from '../api/client';
import { progressApi } from '../api/services';
import type { ProgressRecord } from '../api/types';
import { useToast } from '../context/ToastContext';
import { useSubmitGuard } from '../hooks/useSubmitGuard';
import { todayISO } from '../lib/format';
import * as v from '../lib/validation';
import { Button, FormError, Modal, TextAreaField, TextField } from './ui';

/** Create / edit a progress record (POST or PATCH /progress-records). */
export function ProgressModal({ open, onClose, onSaved, record }: { open: boolean; onClose: () => void; onSaved: () => void; record?: ProgressRecord | null }) {
  const toast = useToast();
  const [recordDate, setRecordDate] = useState(todayISO());
  const [weight, setWeight] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<{ recordDate?: string; weight?: string; notes?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const { submitting: saving, run } = useSubmitGuard();

  useEffect(() => {
    if (!open) return;
    setRecordDate(record?.recordDate ?? todayISO());
    setWeight(record?.weightKg != null ? String(record.weightKg) : '');
    setNotes(record?.notes ?? '');
    setErrors({});
    setServerError(null);
  }, [open, record]);

  /** Mirrors CreateProgressRecordDto and the "weight, notes, or both" rule of the API. */
  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const next: typeof errors = {
      recordDate: v.pastDate(recordDate, 'Date'),
      weight: weight.trim() ? v.decimal(weight, 'Weight', { min: 0, max: v.LIMITS.weightMax, minInclusive: false }) : undefined,
      notes: v.optionalText(notes, 'Notes', v.LIMITS.notes) ?? (!weight.trim() && !notes.trim() ? 'Enter a weight, notes, or both.' : undefined),
    };
    setErrors(next);
    if (v.hasErrors(next)) return;
    const payload = { recordDate, weightKg: weight.trim() ? Number(weight) : null, notes: notes.trim() || null };
    void run(async () => {
      setServerError(null);
      try {
        if (record) await progressApi.update(record.progressId, payload);
        else await progressApi.create(payload);
        toast.success(record ? 'Progress record updated.' : 'Progress recorded.');
        onSaved();
        onClose();
      } catch (err) {
        setServerError(getErrorMessage(err));
      }
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={record ? 'Edit progress record' : 'Add progress record'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="progress-form" loading={saving}>
            {record ? 'Save changes' : 'Add record'}
          </Button>
        </>
      }
    >
      <form id="progress-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <div className="sm:col-span-2">
          <FormError message={serverError} />
        </div>
        <TextField label="Date" type="date" max={todayISO()} value={recordDate} onChange={(e) => setRecordDate(e.target.value)} error={errors.recordDate} />
        <TextField label="Weight (kg)" type="number" step="0.01" min={0} max={v.LIMITS.weightMax} inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} error={errors.weight} placeholder="e.g. 65.5" />
        <TextAreaField label="Notes" className="sm:col-span-2" maxLength={v.LIMITS.notes} hint={`${notes.length} / ${v.LIMITS.notes}`} value={notes} onChange={(e) => setNotes(e.target.value)} error={errors.notes} placeholder="How did training feel? Any milestones?" />
      </form>
    </Modal>
  );
}
