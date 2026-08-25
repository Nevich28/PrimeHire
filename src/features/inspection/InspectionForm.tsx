/**
 * Scheduling and rescheduling.
 *
 * The form validates as you type, using the same rules engine that produces the
 * attention feed: the moment a slot or an inspector is chosen, the consequences
 * are shown underneath. Warnings never block saving — a coordinator can know
 * something the data does not — but they are impossible to miss, which is the
 * difference between a tool that records decisions and one that improves them.
 */

import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { now as clockNow } from '@/domain/clock';
import {
  formatLongDate,
  formatTime,
  fromZurichWallClock,
  parseInstant,
  toZurichIso,
  toZurichParts,
} from '@/domain/datetime';
import { evaluateInspection } from '@/domain/rules';
import { INSPECTION_TYPES, INSPECTORS, PROJECTS } from '@/domain/seed';
import { siteAccessFor } from '@/domain/site-access';
import { useInspectionStore, type InspectionDraft } from '@/domain/store';
import type { Inspection, Priority } from '@/domain/types';
import { useSchedule } from '@/state/useSchedule';
import {
  AppText,
  Badge,
  Button,
  Card,
  Chip,
  Field,
  IconButton,
  Input,
  toneColors,
  useIsWide,
} from '@/ui/primitives';
import { disciplineIcon, severityPresentation, titleCase } from '@/ui/presentation';
import { colors, CONTENT_MAX_WIDTH, radius, spacing } from '@/ui/theme';

import { DatePicker, parseTimeInput, TimeInput } from './DatePicker';
import { InspectorPicker } from './InspectorPicker';
import { ProjectPicker } from './ProjectPicker';

const DURATIONS = [30, 45, 60, 90, 120, 180];
const PRIORITIES: Priority[] = ['normal', 'high', 'critical'];

function durationChipLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest}`;
}

export function InspectionForm({
  inspectionId,
  focusInspector = false,
  onDone,
  onCancel,
}: {
  /** Omitted when scheduling something new. */
  inspectionId?: string;
  /** Opens straight into the inspector picker, for "assign" from the detail. */
  focusInspector?: boolean;
  onDone: (inspectionId: string) => void;
  onCancel: () => void;
}) {
  const isWide = useIsWide();
  const insets = useSafeAreaInsets();
  const schedule = useSchedule();
  const scheduleInspection = useInspectionStore((state) => state.scheduleInspection);
  const updateInspection = useInspectionStore((state) => state.updateInspection);

  const existing = inspectionId ? schedule.byId[inspectionId]?.inspection : undefined;

  // The default slot for new work is tomorrow morning, which is when the next
  // site visit realistically happens when something is raised at end of day.
  const defaults = useMemo(() => {
    const parts = toZurichParts(clockNow());
    return fromZurichWallClock(parts.year, parts.month, parts.day + 1, 8, 0);
  }, []);

  const [projectId, setProjectId] = useState(existing?.projectId ?? '');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [type, setType] = useState(existing?.type ?? 'structural');
  const [priority, setPriority] = useState<Priority>(existing?.priority ?? 'normal');
  const [inspectorId, setInspectorId] = useState<string | null>(existing?.inspectorId ?? null);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [day, setDay] = useState(() =>
    existing ? parseInstant(existing.startsAt) : defaults
  );
  const [time, setTime] = useState(() =>
    existing ? formatTime(parseInstant(existing.startsAt)) : '08:00'
  );
  const [duration, setDuration] = useState(() =>
    existing
      ? Math.round((parseInstant(existing.endsAt) - parseInstant(existing.startsAt)) / 60_000)
      : 60
  );

  const [showProjects, setShowProjects] = useState(false);
  const [showInspectors, setShowInspectors] = useState(focusInspector);
  const [submitted, setSubmitted] = useState(false);

  const parsedTime = parseTimeInput(time);
  const project = PROJECTS[projectId];
  const inspector = inspectorId ? INSPECTORS[inspectorId] : null;
  const access = project ? siteAccessFor(project) : null;

  const start = useMemo(() => {
    const parts = toZurichParts(day);
    return fromZurichWallClock(
      parts.year,
      parts.month,
      parts.day,
      parsedTime?.hour ?? 8,
      parsedTime?.minute ?? 0
    );
  }, [day, parsedTime?.hour, parsedTime?.minute]);

  const end = start + duration * 60_000;

  /** The inspection as it would be saved, used for live rule evaluation. */
  const draft: Inspection = useMemo(
    () => ({
      id: existing?.id ?? 'draft',
      projectId,
      inspectorId,
      title: title.trim() || 'Untitled inspection',
      type,
      status: 'scheduled',
      priority,
      startsAt: toZurichIso(start),
      endsAt: toZurichIso(end),
      notes: notes.trim() || null,
      createdAt: existing?.createdAt ?? toZurichIso(clockNow()),
      cancellationReason: null,
    }),
    [existing, projectId, inspectorId, title, type, priority, start, end, notes]
  );

  const issues = useMemo(
    () => (projectId ? evaluateInspection(draft, schedule.context) : []),
    [draft, projectId, schedule.context]
  );

  const errors = {
    project: !projectId ? 'Choose the project this inspection belongs to.' : undefined,
    title: !title.trim() ? 'Give the inspection a title the site team will recognise.' : undefined,
    time: !parsedTime ? 'Enter a time between 00:00 and 23:59.' : undefined,
  };
  const hasErrors = Object.values(errors).some(Boolean);

  const save = () => {
    setSubmitted(true);
    if (hasErrors) return;

    const payload: InspectionDraft = {
      projectId,
      inspectorId,
      title: title.trim(),
      type,
      priority,
      startsAt: toZurichIso(start),
      endsAt: toZurichIso(end),
      notes: notes.trim() || null,
    };

    if (existing) {
      updateInspection(existing.id, payload);
      onDone(existing.id);
    } else {
      onDone(scheduleInspection(payload));
    }
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon={isWide ? 'close' : 'chevron-back'} label="Discard" onPress={onCancel} />
        <AppText variant="heading" style={styles.flex} numberOfLines={1}>
          {existing ? 'Edit inspection' : 'Schedule inspection'}
        </AppText>
        <Button label="Save" icon="checkmark" onPress={save} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Field label="Project" error={submitted ? errors.project : undefined}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={project ? `Project: ${project.code}. Change project` : 'Choose a project'}
            onPress={() => setShowProjects(true)}
            style={({ hovered }: { hovered?: boolean }) => [
              styles.selector,
              hovered && { borderColor: colors.borderStrong },
              submitted && errors.project ? { borderColor: colors.blocker } : null,
            ]}
          >
            {project ? (
              <View style={styles.flex}>
                <AppText variant="bodyStrong" mono>
                  {project.code}
                </AppText>
                <AppText variant="caption" color={colors.textSecondary} numberOfLines={1}>
                  {project.name}
                </AppText>
              </View>
            ) : (
              <AppText variant="body" color={colors.textMuted} style={styles.flex}>
                Choose a project
              </AppText>
            )}
            <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
          </Pressable>
        </Field>

        {project?.siteNote ? (
          <View style={styles.siteNote}>
            <Ionicons name="information-circle-outline" size={15} color={colors.info} />
            <AppText variant="caption" color={colors.info} style={styles.flex}>
              {project.siteNote}
            </AppText>
          </View>
        ) : null}

        <Field
          label="Title"
          error={submitted ? errors.title : undefined}
          hint="What the inspector is being sent to look at."
        >
          <Input
            value={title}
            onChangeText={setTitle}
            placeholder="Bearing replacement pre-work inspection"
            invalid={submitted && Boolean(errors.title)}
            maxLength={120}
          />
        </Field>

        <Field label="Discipline">
          <View style={styles.chipRow}>
            {INSPECTION_TYPES.map((option) => (
              <Chip
                key={option}
                label={titleCase(option)}
                selected={type === option}
                onPress={() => setType(option)}
              />
            ))}
          </View>
        </Field>

        <Field label="Priority">
          <View style={styles.chipRow}>
            {PRIORITIES.map((option) => (
              <Chip
                key={option}
                label={titleCase(option)}
                selected={priority === option}
                tone={option === 'critical' ? 'blocker' : option === 'high' ? 'warning' : 'accent'}
                onPress={() => setPriority(option)}
              />
            ))}
          </View>
        </Field>

        <Field label="Date">
          <AppText variant="caption" color={colors.textSecondary}>
            {formatLongDate(start)}
          </AppText>
          <DatePicker value={day} now={schedule.now} onChange={setDay} />
        </Field>

        <View style={styles.timeRow}>
          <Field label="Start time" error={submitted ? errors.time : undefined}>
            <TimeInput
              value={time}
              onChange={setTime}
              invalid={submitted && Boolean(errors.time)}
            />
          </Field>

          <Field label="Duration">
            <View style={styles.chipRow}>
              {DURATIONS.map((option) => (
                <Chip
                  key={option}
                  label={durationChipLabel(option)}
                  selected={duration === option}
                  onPress={() => setDuration(option)}
                />
              ))}
            </View>
          </Field>
        </View>

        {access ? (
          <View style={styles.accessNote}>
            <Ionicons name="lock-closed-outline" size={15} color={colors.warning} />
            <AppText variant="caption" color={colors.warning} style={styles.flex}>
              Site access: {access.reason}.
            </AppText>
          </View>
        ) : null}

        <Field label="Inspector">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              inspector ? `Inspector: ${inspector.name}. Change inspector` : 'Assign an inspector'
            }
            onPress={() => setShowInspectors(true)}
            style={({ hovered }: { hovered?: boolean }) => [
              styles.selector,
              hovered && { borderColor: colors.borderStrong },
            ]}
          >
            {inspector ? (
              <View style={styles.flex}>
                <View style={styles.inspectorRow}>
                  <AppText variant="bodyStrong">{inspector.name}</AppText>
                  {!inspector.active ? <Badge label="Inactive" tone="warning" /> : null}
                </View>
                <AppText variant="caption" color={colors.textSecondary} numberOfLines={1}>
                  {inspector.specialties.join(' · ')}
                </AppText>
              </View>
            ) : (
              <View style={styles.flex}>
                <AppText variant="body" color={colors.blocker}>
                  Unassigned
                </AppText>
                <AppText variant="caption" color={colors.textSecondary}>
                  Tap to see who is free at this time.
                </AppText>
              </View>
            )}
            <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
          </Pressable>
        </Field>

        {issues.length > 0 ? (
          <Card style={styles.issueCard}>
            <View style={styles.issueHeader}>
              <Ionicons name="warning-outline" size={16} color={colors.warning} />
              <AppText variant="label" color={colors.textSecondary} uppercase>
                Before you save
              </AppText>
            </View>
            {issues.map((issue, index) => {
              const tone = toneColors(severityPresentation[issue.severity].tone);
              return (
                <View key={`${issue.code}-${index}`} style={styles.issueRow}>
                  <Ionicons
                    name={severityPresentation[issue.severity].icon}
                    size={14}
                    color={tone.fg}
                  />
                  <AppText variant="caption" color={colors.text} style={styles.flex}>
                    {issue.message}
                  </AppText>
                </View>
              );
            })}
            <AppText variant="caption" color={colors.textMuted}>
              None of this stops you saving — it is here so the decision is deliberate.
            </AppText>
          </Card>
        ) : null}

        <Field label="Notes" hint="Anything the inspector needs to know before arriving.">
          <Input
            value={notes}
            onChangeText={setNotes}
            placeholder="Confirm temporary supports and photograph bearing seats."
            multiline
            maxLength={500}
          />
        </Field>

        <View style={styles.summary}>
          <Ionicons name={disciplineIcon(type)} size={16} color={colors.textSecondary} />
          <AppText variant="caption" color={colors.textSecondary} style={styles.flex}>
            {formatTime(start)}–{formatTime(end)} on {formatLongDate(start)}
            {inspector ? `, ${inspector.name}` : ', nobody assigned yet'}
          </AppText>
        </View>

        <View style={styles.actions}>
          <Button label={existing ? 'Save changes' : 'Schedule inspection'} onPress={save} fullWidth />
          <Button label="Discard" variant="ghost" onPress={onCancel} fullWidth />
        </View>
      </ScrollView>

      <ProjectPicker
        visible={showProjects}
        selectedId={projectId}
        onClose={() => setShowProjects(false)}
        onSelect={(id) => {
          setProjectId(id);
          setShowProjects(false);
        }}
      />

      <InspectorPicker
        visible={showInspectors}
        draft={draft}
        context={schedule.context}
        onClose={() => setShowInspectors(false)}
        onSelect={(id) => {
          setInspectorId(id);
          setShowInspectors(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  flex: { flex: 1 },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  inspectorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  timeRow: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: spacing.lg,
    flexWrap: 'wrap',
  },
  siteNote: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: colors.infoSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: -spacing.sm,
  },
  accessNote: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  issueCard: { padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surfaceMuted },
  issueHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  issueRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
  },
  actions: { gap: spacing.sm },
});
