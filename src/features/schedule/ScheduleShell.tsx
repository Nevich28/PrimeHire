/**
 * The schedule, and the frame the whole product lives in.
 *
 * Narrow screens get a single scrolling column: the same people use this on a
 * phone while standing next to a site gate. From 900px up there is room to keep
 * the schedule on the left and the open inspection on the right, which is how
 * the same job is done at a desk — pick something, act on it, keep your place
 * in the list.
 *
 * Both layouts are the same component tree with a different arrangement, not
 * two implementations.
 */

import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatDayHeading, formatLongDate } from '@/domain/datetime';
import { groupByDay, isOpen } from '@/domain/selectors';
import { COMPANY } from '@/domain/seed';
import { useInspectionStore } from '@/domain/store';
import type { ResolvedInspection } from '@/domain/types';
import { useSchedule } from '@/state/useSchedule';
import { AppText, Button, Chip, EmptyState, Input, useIsWide } from '@/ui/primitives';
import { colors, CONTENT_MAX_WIDTH, elevation, radius, spacing } from '@/ui/theme';

import { AttentionFeed } from './AttentionFeed';
import { InspectionCard } from './InspectionCard';

type FilterKey = 'upcoming' | 'attention' | 'unassigned' | 'history';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'attention', label: 'Needs attention' },
  { key: 'unassigned', label: 'Unassigned' },
  { key: 'history', label: 'History' },
];

export function ScheduleShell({
  selectedId,
  detail,
  onSelect,
  onCreate,
  onOpenInspectors,
}: {
  selectedId?: string;
  /** Rendered in the right-hand pane on wide screens. */
  detail?: ReactNode;
  onSelect: (inspectionId: string) => void;
  onCreate: () => void;
  onOpenInspectors: () => void;
}) {
  const isWide = useIsWide();
  const insets = useSafeAreaInsets();
  const schedule = useSchedule();
  const [filter, setFilter] = useState<FilterKey>('upcoming');
  const [query, setQuery] = useState('');

  const { items, issuesByInspection, issues, counts, now } = schedule;

  const filterCounts = useMemo(
    () => ({
      upcoming: items.filter((item) => isOpen(item)).length,
      attention: items.filter(
        (item) => isOpen(item) && (issuesByInspection[item.inspection.id]?.length ?? 0) > 0
      ).length,
      unassigned: counts.unassigned,
      history: items.filter((item) => !isOpen(item)).length,
    }),
    [items, issuesByInspection, counts.unassigned]
  );

  const sections = useMemo(() => {
    const needle = query.trim().toLowerCase();

    const matchesQuery = (item: ResolvedInspection) => {
      if (!needle) return true;
      return [
        item.inspection.title,
        item.inspection.type,
        item.project.code,
        item.project.name,
        item.project.client,
        item.inspector?.name ?? 'unassigned',
      ]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    };

    const matchesFilter = (item: ResolvedInspection) => {
      switch (filter) {
        case 'upcoming':
          return isOpen(item);
        case 'attention':
          return isOpen(item) && (issuesByInspection[item.inspection.id]?.length ?? 0) > 0;
        case 'unassigned':
          return isOpen(item) && !item.inspection.inspectorId;
        case 'history':
          return !isOpen(item);
      }
    };

    const visible = items.filter((item) => matchesFilter(item) && matchesQuery(item));
    // History reads newest first; everything else reads soonest first.
    const ordered = filter === 'history' ? [...visible].reverse() : visible;
    const groups = groupByDay(ordered);
    return (filter === 'history' ? groups.reverse() : groups).map((group) => ({
      key: group.key,
      date: group.date,
      data: group.items,
    }));
  }, [items, issuesByInspection, filter, query]);

  const list = (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.inspection.id}
      stickySectionHeadersEnabled
      contentContainerStyle={[
        styles.listContent,
        // Room at the bottom for the floating action button and, on Android,
        // for the system navigation bar the app draws behind.
        !isWide && { paddingBottom: insets.bottom + 96 },
      ]}
      showsVerticalScrollIndicator={isWide}
      ListHeaderComponent={
        <View style={styles.listHeader}>
          {!isWide ? <Header now={now} onOpenInspectors={onOpenInspectors} /> : null}

          <AttentionFeed
            issues={issues}
            byId={schedule.byId}
            now={now}
            onSelect={(id) => {
              const target = schedule.byId[id];
              if (target && !isOpen(target)) setFilter('history');
              onSelect(id);
            }}
          />

          <View style={styles.searchRow}>
            <Ionicons name="search" size={16} color={colors.textMuted} style={styles.searchIcon} />
            <View style={styles.searchInput}>
              <Input
                value={query}
                onChangeText={setQuery}
                placeholder="Search title, project, client or inspector"
                style={styles.searchField}
              />
            </View>
            {query.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                onPress={() => setQuery('')}
                style={styles.searchClear}
              >
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.filters}>
            {FILTERS.map((option) => (
              <Chip
                key={option.key}
                label={option.label}
                count={filterCounts[option.key]}
                selected={filter === option.key}
                onPress={() => setFilter(option.key)}
              />
            ))}
          </View>
        </View>
      }
      renderSectionHeader={({ section }) => (
        <View style={styles.sectionHeader}>
          <AppText variant="label" color={colors.textSecondary}>
            {formatDayHeading(section.date, now)}
          </AppText>
          <View style={styles.sectionRule} />
          <AppText variant="caption" color={colors.textMuted}>
            {section.data.length}
          </AppText>
        </View>
      )}
      renderItem={({ item }) => (
        <View style={styles.cardWrapper}>
          <InspectionCard
            item={item}
            issues={issuesByInspection[item.inspection.id] ?? []}
            selected={isWide && item.inspection.id === selectedId}
            onPress={() => onSelect(item.inspection.id)}
          />
        </View>
      )}
      ListFooterComponent={<DemoDataFooter />}
      ListEmptyComponent={
        <EmptyState
          icon={query ? 'search-outline' : 'calendar-clear-outline'}
          title={query ? 'Nothing matches that search' : emptyTitle(filter)}
          message={
            query
              ? 'Try a project code such as A12-NA-018, a client, or an inspector name.'
              : emptyMessage(filter)
          }
          action={
            filter === 'upcoming' && !query ? (
              <Button label="Schedule inspection" icon="add" onPress={onCreate} />
            ) : null
          }
        />
      }
    />
  );

  if (!isWide) {
    return (
      // The safe area belongs to the container rather than to the scroll
      // content: that way the sticky day headings come to rest below the
      // status bar and notch instead of underneath them.
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        {list}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Schedule inspection"
          onPress={onCreate}
          style={({ pressed }: { pressed: boolean }) => [
            styles.fab,
            elevation.raised,
            { bottom: insets.bottom + spacing.lg },
            pressed && { backgroundColor: colors.accentHover },
          ]}
        >
          <Ionicons name="add" size={22} color={colors.textInverse} />
          <AppText variant="label" color={colors.textInverse}>
            Schedule
          </AppText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.wideHeader, { paddingTop: insets.top + spacing.lg }]}>
        <View style={styles.flex}>
          <Header now={now} onOpenInspectors={onOpenInspectors} />
        </View>
        <Button label="Schedule inspection" icon="add" onPress={onCreate} />
      </View>
      <View style={styles.wideBody}>
        <View style={styles.wideList}>{list}</View>
        <View style={styles.widePane}>{detail}</View>
      </View>
    </View>
  );
}

function Header({ now, onOpenInspectors }: { now: number; onOpenInspectors: () => void }) {
  return (
    <View style={styles.headerRow}>
      <View style={styles.flex}>
        <AppText variant="micro" color={colors.textMuted} uppercase>
          {COMPANY}
        </AppText>
        <AppText variant="display">Site inspections</AppText>
        <AppText variant="caption" color={colors.textSecondary}>
          {formatLongDate(now)}
        </AppText>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Inspector workload"
        onPress={onOpenInspectors}
        style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
          styles.headerAction,
          (hovered || pressed) && { backgroundColor: colors.neutralSoft },
        ]}
      >
        <Ionicons name="people-outline" size={18} color={colors.textSecondary} />
        <AppText variant="label" color={colors.textSecondary}>
          Inspectors
        </AppText>
      </Pressable>
    </View>
  );
}

/**
 * Where the data lives, and how to get back to the delivered dataset.
 *
 * Changes are kept on the device rather than on a server, which is worth saying
 * out loud in a tool people share between a laptop and a phone. The reset is
 * here so anyone reviewing the app can undo their experiments and see the
 * original `data.json` again.
 */
function DemoDataFooter() {
  const resetToSeed = useInspectionStore((state) => state.resetToSeed);
  const [confirming, setConfirming] = useState(false);

  return (
    <View style={styles.footer}>
      <AppText variant="caption" color={colors.textMuted} style={styles.footerText}>
        Changes are saved on this device only.
      </AppText>
      {confirming ? (
        <View style={styles.footerActions}>
          <Button
            label="Reset to delivered data"
            variant="danger"
            onPress={() => {
              resetToSeed();
              setConfirming(false);
            }}
          />
          <Button label="Keep my changes" variant="ghost" onPress={() => setConfirming(false)} />
        </View>
      ) : (
        <Button
          label="Reset demo data"
          variant="ghost"
          icon="refresh-outline"
          onPress={() => setConfirming(true)}
        />
      )}
    </View>
  );
}

function emptyTitle(filter: FilterKey): string {
  switch (filter) {
    case 'upcoming':
      return 'No inspections on the schedule';
    case 'attention':
      return 'Nothing needs attention';
    case 'unassigned':
      return 'Every inspection has an inspector';
    case 'history':
      return 'No past inspections yet';
  }
}

function emptyMessage(filter: FilterKey): string {
  switch (filter) {
    case 'upcoming':
      return 'Schedule the first inspection and it will appear here, grouped by day.';
    case 'attention':
      return 'No clashes, no unassigned work and nothing outside a site access window.';
    case 'unassigned':
      return 'Every open inspection has somebody going to site.';
    case 'history':
      return 'Completed and cancelled inspections are kept here.';
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
    maxWidth: CONTENT_MAX_WIDTH,
    width: '100%',
    alignSelf: 'center',
  },
  listHeader: { gap: spacing.md, paddingBottom: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  headerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  searchRow: { justifyContent: 'center' },
  searchIcon: { position: 'absolute', left: spacing.md, zIndex: 1 },
  searchInput: { flex: 1 },
  searchClear: { position: 'absolute', right: spacing.md },
  searchField: { paddingLeft: spacing.xl + spacing.xs, paddingRight: spacing.xl },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.canvas,
  },
  sectionRule: { flex: 1, height: 1, backgroundColor: colors.border },
  cardWrapper: { paddingBottom: spacing.sm },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  wideHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  wideBody: { flex: 1, flexDirection: 'row' },
  footer: { alignItems: 'center', gap: spacing.xs, paddingTop: spacing.xl, paddingBottom: spacing.lg },
  footerText: { textAlign: 'center' },
  footerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  wideList: {
    width: 460,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  widePane: { flex: 1, backgroundColor: colors.canvas },
});
