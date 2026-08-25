/**
 * Cancelling an inspection.
 *
 * Cancellation is not a delete: the record stays, and the reason stays with it.
 * `data.json` already works this way — every cancelled inspection in the seed
 * carries the sentence that explains it — and that sentence is what stops the
 * next person ringing round to ask what happened.
 *
 * The reason is therefore required rather than optional.
 */

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatDayDistance, formatTimeRange } from '@/domain/datetime';
import { useInspectionStore } from '@/domain/store';
import type { ResolvedInspection } from '@/domain/types';
import { useSchedule } from '@/state/useSchedule';
import { AppText, Button, Field, Input } from '@/ui/primitives';
import { Sheet } from '@/ui/Sheet';
import { colors, radius, spacing } from '@/ui/theme';

const SUGGESTIONS = [
  'Project placed on hold by client.',
  'Works delayed on site.',
  'Rescheduled with the site team.',
  'No longer required.',
];

export function CancelDialog({
  visible,
  item,
  onClose,
  onCancelled,
}: {
  visible: boolean;
  item: ResolvedInspection;
  onClose: () => void;
  onCancelled: () => void;
}) {
  const cancelInspection = useInspectionStore((state) => state.cancelInspection);
  const { now } = useSchedule();
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  const trimmed = reason.trim();
  const invalid = touched && trimmed.length === 0;

  const close = () => {
    setReason('');
    setTouched(false);
    onClose();
  };

  const confirm = () => {
    setTouched(true);
    if (trimmed.length === 0) return;
    cancelInspection(item.inspection.id, trimmed);
    setReason('');
    setTouched(false);
    onCancelled();
  };

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title="Cancel this inspection"
      subtitle={`${item.project.code} · ${formatDayDistance(item.start, now)} at ${formatTimeRange(item.start, item.end)}`}
      footer={
        <>
          <Button label="Keep it" variant="secondary" onPress={close} />
          <Button label="Cancel inspection" variant="danger" onPress={confirm} />
        </>
      }
    >
      <View style={styles.summary}>
        <AppText variant="bodyStrong">{item.inspection.title}</AppText>
        <AppText variant="caption" color={colors.textSecondary}>
          The inspection stays in the history with the reason attached, so the site team can see
          why it did not happen.
        </AppText>
      </View>

      <Field
        label="Why is it being cancelled?"
        error={invalid ? 'A reason is required — this is what the site team will read.' : undefined}
      >
        <Input
          value={reason}
          onChangeText={(next) => {
            setReason(next);
            if (!touched) setTouched(true);
          }}
          placeholder="Rail possession moved to a later date."
          multiline
          invalid={invalid}
          maxLength={280}
        />
      </Field>

      <View style={styles.suggestions}>
        {SUGGESTIONS.map((suggestion) => (
          <Button
            key={suggestion}
            label={suggestion}
            variant="ghost"
            onPress={() => {
              setReason(suggestion);
              setTouched(true);
            }}
            style={styles.suggestion}
          />
        ))}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  summary: {
    gap: spacing.xs,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  suggestions: { gap: spacing.xs },
  suggestion: { alignSelf: 'flex-start', paddingHorizontal: spacing.sm, minHeight: 34 },
});
