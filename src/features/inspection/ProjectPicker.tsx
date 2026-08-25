/**
 * Choosing the project.
 *
 * Two of the eight projects are called "A12 East Viaduct Rehabilitation — North
 * Approach/Abutment Structure". Picking the wrong one sends an inspector to the
 * wrong side of the same viaduct, so the code leads, the town is shown, and
 * projects that are not running are visibly marked rather than hidden.
 */

import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PROJECT_LIST } from '@/domain/seed';
import { AppText, Badge, Input, type PressableState } from '@/ui/primitives';
import { projectStatusLabel } from '@/ui/presentation';
import { Sheet } from '@/ui/Sheet';
import { colors, radius, spacing } from '@/ui/theme';

export function ProjectPicker({
  visible,
  selectedId,
  onClose,
  onSelect,
}: {
  visible: boolean;
  selectedId: string;
  onClose: () => void;
  onSelect: (projectId: string) => void;
}) {
  const [query, setQuery] = useState('');

  const projects = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return PROJECT_LIST;
    return PROJECT_LIST.filter((project) =>
      `${project.code} ${project.name} ${project.client} ${project.address}`
        .toLowerCase()
        .includes(needle)
    );
  }, [query]);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Choose a project"
      subtitle="Project codes are the reliable way to tell similar structures apart."
    >
      <Input value={query} onChangeText={setQuery} placeholder="Search code, name or client" />

      {projects.map((project) => {
        const selected = project.id === selectedId;
        return (
          <Pressable
            key={project.id}
            accessibilityRole="button"
            accessibilityLabel={`${project.code}, ${project.name}`}
            accessibilityState={{ selected }}
            onPress={() => onSelect(project.id)}
            style={({ hovered }: PressableState) => [
              styles.option,
              hovered && { backgroundColor: colors.surfaceMuted },
              selected && styles.optionSelected,
            ]}
          >
            <View style={styles.flex}>
              <View style={styles.codeRow}>
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
              <AppText variant="body" numberOfLines={2}>
                {project.name}
              </AppText>
              <AppText variant="caption" color={colors.textMuted} numberOfLines={1}>
                {project.client} · {project.address}
              </AppText>
            </View>

            {selected ? <Ionicons name="checkmark-circle" size={20} color={colors.accent} /> : null}
          </Pressable>
        );
      })}

      {projects.length === 0 ? (
        <AppText variant="caption" color={colors.textMuted} style={styles.noResults}>
          No project matches that search.
        </AppText>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  flex: { flex: 1, gap: 2 },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  noResults: { textAlign: 'center', paddingVertical: spacing.lg },
});
