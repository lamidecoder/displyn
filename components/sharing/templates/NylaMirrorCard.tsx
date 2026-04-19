import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TAG_THEME } from '../../../lib/theme';

interface Props {
  title: string;
  strengths: string[];
  blindSpots: string[];
  primaryTag?: string;
  accentColor?: string;
}

export default function NylaMirrorCard({ title, strengths, blindSpots, primaryTag, accentColor = '#7C5CFC' }: Props) {
  const tagMeta = primaryTag ? (TAG_THEME as any)[primaryTag] : null;
  const tagColor = tagMeta?.color;
  const tagIcon = tagMeta?.icon;

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionLabel, { color: accentColor }]}>{"Nyla's Mirror"}</Text>
      <Text style={styles.title}>{title}</Text>

      <View style={[styles.divider, { backgroundColor: accentColor }]} />

      {strengths.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Strengths</Text>
          {strengths.slice(0, 2).map((s, i) => (
            <Text key={i} style={styles.insightText}>{s}</Text>
          ))}
        </View>
      )}

      {blindSpots.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: '#F87171' }]}>Blind Spots</Text>
          {blindSpots.slice(0, 2).map((b, i) => (
            <Text key={i} style={styles.insightText}>{b}</Text>
          ))}
        </View>
      )}

      {primaryTag && (
        <View style={[styles.tagPill, { backgroundColor: (tagColor || accentColor) + '25' }]}>
          {tagIcon ? <Text style={styles.tagIconTxt}>{tagIcon}</Text> : null}
          <Text style={[styles.tagText, { color: tagColor || accentColor }]}>{primaryTag}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  sectionLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '700', marginBottom: 16, lineHeight: 30 },
  divider: { width: 40, height: 2, borderRadius: 1, marginBottom: 20 },
  section: { marginBottom: 16 },
  sectionTitle: { color: '#34D399', fontSize: 13, fontWeight: '600', marginBottom: 6 },
  insightText: { color: '#D4D4D8', fontSize: 13, lineHeight: 20, marginBottom: 4 },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 8,
  },
  tagIconTxt: { fontSize: 14, marginRight: 6 },
  tagText: { fontSize: 12, fontWeight: '600' },
});
