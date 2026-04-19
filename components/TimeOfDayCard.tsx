import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, G } from 'react-native-svg';

interface BlockStat {
  total: number;
  completed: number;
  rate: number;
}

interface TimeOfDayStats {
  morning: BlockStat;
  afternoon: BlockStat;
  evening: BlockStat;
  primary: 'morning' | 'afternoon' | 'evening';
}

interface Props {
  stats: TimeOfDayStats;
  healthLabel: string;
  healthColor: string;
  theme: any;
}

function MorningIcon({ color, size }: { color: string; size: number }) {
  const r = size * 0.2;
  const rayLen = size * 0.14;
  const rayDist = size * 0.38;
  const cx = size / 2;
  const cy = size / 2;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={1.6} />
      {[0, 60, 120, 180, 240, 300].map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        const x1 = cx + Math.cos(rad) * (rayDist - rayLen);
        const y1 = cy + Math.sin(rad) * (rayDist - rayLen);
        const x2 = cx + Math.cos(rad) * rayDist;
        const y2 = cy + Math.sin(rad) * rayDist;
        return (
          <Path
            key={i}
            d={`M ${x1} ${y1} L ${x2} ${y2}`}
            stroke={color}
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        );
      })}
    </Svg>
  );
}

function AfternoonIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={size / 2} cy={size / 2} r={size * 0.3} fill={color} opacity={0.85} />
    </Svg>
  );
}

function EveningIcon({ color, size, bgColor }: { color: string; size: number; bgColor?: string }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.3;
  const offset = size * 0.18;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <G>
        <Circle cx={cx} cy={cy} r={r} fill={color} opacity={0.85} />
        <Circle cx={cx + offset} cy={cy - offset * 0.5} r={r * 0.82} fill={bgColor || '#1C1C1E'} />
      </G>
    </Svg>
  );
}

const BLOCKS: { key: 'morning' | 'afternoon' | 'evening'; label: string; Icon: any }[] = [
  { key: 'morning', label: 'Morning', Icon: MorningIcon },
  { key: 'afternoon', label: 'Afternoon', Icon: AfternoonIcon },
  { key: 'evening', label: 'Evening', Icon: EveningIcon },
];

export default function TimeOfDayCard({ stats, healthLabel, healthColor, theme }: Props) {
  const highestBlock = BLOCKS.reduce((best, b) =>
    stats[b.key].rate > stats[best.key].rate ? b : best, BLOCKS[0]);

  return (
    <View>
      <View style={styles.row}>
        {BLOCKS.map((block) => {
          const isActive = stats.primary === block.key;
          const iconColor = isActive ? theme.primary : theme.textTertiary;
          const rate = stats[block.key].rate;
          const pillBg = isActive ? theme.primaryMuted : theme.surface;

          return (
            <View
              key={block.key}
              style={[
                styles.pill,
                { backgroundColor: pillBg, borderColor: theme.surfaceBorder },
                isActive && {
                  borderColor: theme.primary,
                  transform: [{ scale: 1.05 }],
                  ...Platform.select({
                    ios: { shadowColor: theme.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 8 },
                    android: { elevation: 4 },
                  }),
                },
              ]}
            >
              {block.key === 'evening'
                ? <block.Icon color={iconColor} size={28} bgColor={pillBg} />
                : <block.Icon color={iconColor} size={28} />
              }
              <Text style={[styles.pillLabel, { color: isActive ? theme.primary : theme.textSecondary }]}>
                {block.label}
              </Text>
              <Text style={[styles.pillRate, { color: isActive ? theme.primary : theme.textTertiary }]}>
                {rate}%
              </Text>
            </View>
          );
        })}
      </View>
      {stats[highestBlock.key].total > 0 && (
        <Text style={[styles.insight, { color: theme.textSecondary }]}>
          You complete this task most often in the {highestBlock.label.toLowerCase()}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  pill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  pillLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  pillRate: {
    fontSize: 14,
    fontWeight: '800',
  },
  insight: {
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
