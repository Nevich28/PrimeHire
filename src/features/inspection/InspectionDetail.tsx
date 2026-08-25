/**
 * Everything about one inspection.
 *
 * The ordering is the ordering of the questions people actually ask when
 * something changes: what is wrong with it, when is it, where is it and who do
 * I call, who is going, and what was said. Site notes and phone numbers are
 * first-class here because the alternative — the thing the client complained
 * about — is ringing a colleague to ask.
 */

import { Ionicons } from '@expo/vector-icons';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  durationLabel,
  formatDayDistance,
  formatLongDate,
  formatTimeRange,
  parseInstant,
} from '@/domain/datetime';
import type { Issue } from '@/domain/rules';
import { siteAccessFor } from '@/domain/site-access';
import type { ResolvedInspection } from '@/domain/types';
import {
  priorityPresentation,
  projectStatusLabel,
  severityPresentation,
  statusPresentation,
  titleCase,
} from '@/ui/presentation';
import { AppText, Badge, Button, Card, DetailRow, Divider, toneColors, type PressableState } from '@/ui/primitives';
import { colors, radius, spacing } from '@/ui/theme';

export function InspectionDetail({
  item,
  issues,
  now,
  onEdit,
  onAssign,
  onCancel,
  onComplete,
  onReopen,
}: {
  item: ResolvedInspection;
  issues: Issue[];
  now: number;
  onEdit: () => void;
  onAssign: () => void;
  onCancel: () => void;
  onComplete: () => void;
  onReopen: () => void;
}) {
  const { inspection, project, inspector } = item;
  const status = statusPresentation[inspection.status];
  const priority = priorityPresentation[inspection.priority];
  const access = siteAccessFor(project);
  const isOpen = inspection.status === 'scheduled';
  const hasStarted = item.start <= now;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.titleBlock}>
        <View style={styles.badgeRow}>
          <Badge label={status.label} tone={status.tone} icon={status.icon} />
          {priority.showBadge ? <Badge label={priority.label} tone={priority.tone} /> : null}
          <Badge label={titleCase(inspection.type)} tone="neutral" />
        </View>
        <AppText variant="title">{inspection.title}</AppText>
      </View>

      {issues.length > 0 ? <IssuePanel issues={issues} onAssign={onAssign} /> : null}

      <Card style={styles.card}>
        <DetailRow icon="time-outline" label="When">
          <AppText variant="bodyStrong">{formatLongDate(item.start)}</AppText>
          <AppText variant="body" color={colors.textSecondary}>
            {formatTimeRange(item.start, item.end)} · {durationLabel(item.start, item.end)} ·{' '}
            {formatDayDistance(item.start, now)}
          </AppText>
        </DetailRow>

        {access ? (
          <View style={styles.accessNote}>
            <Ionicons name="lock-closed-outline" size={14} color={colors.warning} />
            <AppText variant="caption" color={colors.warning} style={styles.flex}>
              Site access: {access.reason}.
            </AppText>
          </View>
        ) : null}
      </Card>

      <Card style={styles.card}>
        <DetailRow icon="business-outline" label="Project">
          <View style={styles.projectHeading}>
            <AppText variant="bodyStrong" mono>
              {project.code}
            </AppText>
            {project.status !== 'active' ? (
              <Badge
                label={projectStatusLabel[project.status] ?? project.status}
                tone={project.status === 'on_hold' ? 'warning' : 'neutral'}
              />
            ) : null}
          </View>
          <AppText variant="body">{project.name}</AppText>
          <AppText variant="caption" color={colors.textSecondary}>
            {project.client}
          </AppText>
        </DetailRow>

        <Divider />

        <DetailRow icon="location-outline" label="Address">
          <AppText variant="body">{project.address}</AppText>
        </DetailRow>

        {project.siteNote ? (
          <View style={styles.siteNote}>
            <Ionicons name="information-circle-outline" size={16} color={colors.info} />
            <AppText variant="caption" color={colors.info} style={styles.flex}>
              {project.siteNote}
            </AppText>
          </View>
        ) : null}

        <Divider />

        <DetailRow icon="call-outline" label="Site contact">
          <AppText variant="body">{project.contact.name}</AppText>
          <PhoneLink phone={project.contact.phone} />
        </DetailRow>
      </Card>

      <Card style={styles.card}>
        <DetailRow icon={inspector ? 'person-outline' : 'person-remove-outline'} label="Inspector">
          {inspector ? (
            <>
              <View style={styles.projectHeading}>
                <AppText variant="bodyStrong">{inspector.name}</AppText>
                {!inspector.active ? <Badge label="Inactive" tone="warning" /> : null}
              </View>
              <PhoneLink phone={inspector.phone} />
              <ContactLink
                icon="mail-outline"
                label={inspector.email}
                url={`mailto:${inspector.email}`}
              />
              <View style={styles.specialties}>
                {inspector.specialties.map((specialty) => (
                  <Badge key={specialty} label={specialty} tone="neutral" />
                ))}
              </View>
            </>
          ) : (
            <>
              <AppText variant="body" color={colors.blocker}>
                Nobody is assigned yet.
              </AppText>
              {isOpen ? (
                <Button
                  label="Assign inspector"
                  icon="person-add-outline"
                  onPress={onAssign}
                  style={styles.assignButton}
                />
              ) : null}
            </>
          )}
        </DetailRow>
      </Card>

      {inspection.notes ? (
        <Card style={styles.card}>
          <DetailRow icon="document-text-outline" label="Notes">
            <AppText variant="body">{inspection.notes}</AppText>
          </DetailRow>
        </Card>
      ) : null}

      {inspection.status === 'cancelled' ? (
        <Card style={[styles.card, styles.closureCard]}>
          <DetailRow icon="close-circle-outline" label="Cancelled">
            <AppText variant="body">{inspection.cancellationReason ?? 'No reason given.'}</AppText>
            {inspection.cancelledAt ? (
              <AppText variant="caption" color={colors.textMuted}>
                {formatLongDate(parseInstant(inspection.cancelledAt))}
              </AppText>
            ) : null}
          </DetailRow>
        </Card>
      ) : null}

      {inspection.status === 'completed' && inspection.completedAt ? (
        <Card style={[styles.card, styles.closureCard]}>
          <DetailRow icon="checkmark-circle-outline" label="Completed">
            <AppText variant="body">
              {formatLongDate(parseInstant(inspection.completedAt))}
            </AppText>
          </DetailRow>
        </Card>
      ) : null}

      <View style={styles.actions}>
        {isOpen ? (
          <>
            <Button label="Edit or reschedule" icon="create-outline" onPress={onEdit} />
            <Button
              label={inspector ? 'Reassign' : 'Assign inspector'}
              icon="person-add-outline"
              variant="secondary"
              onPress={onAssign}
            />
            {hasStarted ? (
              <Button
                label="Mark completed"
                icon="checkmark-outline"
                variant="secondary"
                onPress={onComplete}
              />
            ) : null}
            <Button label="Cancel inspection" icon="close-outline" variant="danger" onPress={onCancel} />
          </>
        ) : (
          <Button
            label="Put back on the schedule"
            icon="refresh-outline"
            variant="secondary"
            onPress={onReopen}
          />
        )}
      </View>

      <AppText variant="caption" color={colors.textMuted} style={styles.created}>
        {inspection.id} · raised {formatDayDistance(parseInstant(inspection.createdAt), now)}
      </AppText>
    </ScrollView>
  );
}

function IssuePanel({ issues, onAssign }: { issues: Issue[]; onAssign: () => void }) {
  const worst = issues.some((issue) => issue.severity === 'blocker') ? 'blocker' : 'warning';
  const tone = toneColors(severityPresentation[worst].tone);
  const unassigned = issues.some((issue) => issue.code === 'unassigned');

  return (
    <Card style={[styles.card, { backgroundColor: tone.bg, borderColor: tone.fg + '33' }]}>
      <View style={styles.issueHeader}>
        <Ionicons name={severityPresentation[worst].icon} size={18} color={tone.fg} />
        <AppText variant="heading" color={tone.fg}>
          {issues.length === 1 ? 'One thing to sort out' : `${issues.length} things to sort out`}
        </AppText>
      </View>

      {issues.map((issue, index) => {
        const issueTone = toneColors(severityPresentation[issue.severity].tone);
        return (
          <View key={`${issue.code}-${index}`} style={styles.issueLine}>
            <View style={[styles.issueDot, { backgroundColor: issueTone.fg }]} />
            <AppText variant="body" color={colors.text} style={styles.flex}>
              {issue.message}
            </AppText>
          </View>
        );
      })}

      {unassigned ? (
        <Button
          label="Assign inspector"
          icon="person-add-outline"
          onPress={onAssign}
          style={styles.issueAction}
        />
      ) : null}
    </Card>
  );
}

function PhoneLink({ phone }: { phone: string | null }) {
  if (!phone) {
    return (
      <AppText variant="caption" color={colors.textMuted}>
        No phone number on file
      </AppText>
    );
  }
  return <ContactLink icon="call-outline" label={phone} url={`tel:${phone.replace(/\s/g, '')}`} />;
}

function ContactLink({
  icon,
  label,
  url,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  url: string;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => {
        // Opens the dialer on a phone and the mail or tel handler on the web.
        Linking.openURL(url).catch(() => {
          /* No handler registered — nothing useful to do beyond ignoring it. */
        });
      }}
      style={({ hovered }: PressableState) => [
        styles.contactLink,
        hovered && Platform.OS === 'web' ? { opacity: 0.7 } : null,
      ]}
    >
      <Ionicons name={icon} size={14} color={colors.accent} />
      <AppText variant="body" color={colors.accent}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  titleBlock: { gap: spacing.sm },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  card: { padding: spacing.lg, gap: spacing.md },
  flex: { flex: 1 },
  projectHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  siteNote: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: colors.infoSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  accessNote: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  specialties: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  assignButton: { alignSelf: 'flex-start', marginTop: spacing.sm },
  closureCard: { backgroundColor: colors.surfaceMuted },
  issueHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  issueLine: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  issueDot: { width: 6, height: 6, borderRadius: radius.pill, marginTop: 8 },
  issueAction: { alignSelf: 'flex-start', marginTop: spacing.xs },
  contactLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: 2 },
  actions: { gap: spacing.sm, marginTop: spacing.xs },
  created: { textAlign: 'center', marginTop: spacing.sm },
});
