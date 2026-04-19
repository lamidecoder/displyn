import React, { useCallback, useEffect, useState } from 'react';
import {
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop, Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import {
  getComparisonData,
  getCompletionRate,
  getMonthlyTrend,
  getProductivityHeatmap,
  getStreak,
  getTagBreakdown,
  getWeekDayStatus,
} from '../../lib/analytics';
import { getProfile } from '../../lib/tasks';
import { useTheme } from '../../lib/ThemeContext';
import { useProfile } from '../../lib/ProfileContext';
import { TAG_COLORS } from '../../lib/types';
import ShareModal from '../../components/sharing/ShareModal';
import { ShareData } from '../../components/sharing/types';

const STREAK_ASSETS = {
  fire: require('../../assets/icons/streak-fire.png'),
};
const SHARE_ICON = require('../../assets/icons/share-icon.png');

const DEFAULT_DAYS = 30;

// ======= Donut Chart (single segment) =======
function DonutChart({ percentage, size, strokeWidth, color, bgColor, useGradient, textColor }: {
  percentage: number; size: number; strokeWidth: number; color: string; bgColor: string;
  useGradient?: boolean; textColor?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (circumference * Math.min(percentage, 100)) / 100;
  const center = size / 2;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        {useGradient && (
          <Defs>
            <LinearGradient id="donutGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={color} />
              <Stop offset="1" stopColor={color + '90'} />
            </LinearGradient>
          </Defs>
        )}
        <Circle
          cx={center} cy={center} r={radius}
          stroke={bgColor} strokeWidth={strokeWidth} fill="none"
        />
        <Circle
          cx={center} cy={center} r={radius}
          stroke={useGradient ? 'url(#donutGrad)' : color}
          strokeWidth={strokeWidth} fill="none"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${center}, ${center}`}
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ fontSize: size * 0.22, fontWeight: '800', color: textColor || color }}>{percentage}%</Text>
      </View>
    </View>
  );
}

// ======= Multi-Segment Donut (for tag breakdown) =======
function MultiDonut({ segments, size, strokeWidth, bgColor, centerLabel, textColor }: {
  segments: { percentage: number; color: string }[];
  size: number; strokeWidth: number; bgColor: string; centerLabel?: string; textColor?: string;
}) {
  const outerPad = 20; // extra space for percentage labels
  const fullSize = size + outerPad * 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = fullSize / 2;

  // Build segments with cumulative offset + midpoint angle for labels
  let cumulativePercent = 0;
  const arcs = segments.filter(s => s.percentage > 0).map((seg) => {
    const dashLength = (circumference * seg.percentage) / 100;
    const dashGap = circumference - dashLength;
    const startAngle = -90 + (cumulativePercent * 360) / 100;
    const midAngle = startAngle + (seg.percentage * 360) / 200; // midpoint
    cumulativePercent += seg.percentage;
    return { ...seg, dashLength, dashGap, startAngle, midAngle };
  });

  // Calculate label positions
  const labelRadius = radius + strokeWidth / 2 + 14;

  return (
    <View style={{ width: fullSize, height: fullSize, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={fullSize} height={fullSize}>
        <Circle
          cx={center} cy={center} r={radius}
          stroke={bgColor} strokeWidth={strokeWidth} fill="none"
        />
        {arcs.map((arc, i) => (
          <Circle
            key={i}
            cx={center} cy={center} r={radius}
            stroke={arc.color} strokeWidth={strokeWidth} fill="none"
            strokeDasharray={`${arc.dashLength} ${arc.dashGap}`}
            rotation={arc.startAngle}
            origin={`${center}, ${center}`}
          />
        ))}
      </Svg>
      {/* Percentage labels around the donut */}
      {arcs.map((arc, i) => {
        if (arc.percentage < 5) return null; // skip tiny segments
        const angleRad = (arc.midAngle * Math.PI) / 180;
        const lx = center + labelRadius * Math.cos(angleRad);
        const ly = center + labelRadius * Math.sin(angleRad);
        return (
          <Text
            key={i}
            style={{
              position: 'absolute',
              left: lx - 14,
              top: ly - 7,
              width: 28,
              fontSize: 8,
              fontWeight: '700',
              color: textColor || '#fff',
              textAlign: 'center',
            }}
          >
            {arc.percentage}%
          </Text>
        );
      })}
      {/* Center label */}
      {centerLabel && (
        <View style={{ position: 'absolute', alignItems: 'center' }}>
          <Text style={{ fontSize: size * 0.18, fontWeight: '800', color: textColor || '#fff' }}>
            {centerLabel}
          </Text>
        </View>
      )}
    </View>
  );
}

// ======= Line Chart =======
function LineChart({ data, height, textColor }: {
  data: { month: string; rate: number; hasData?: boolean }[]; height: number; textColor: string;
}) {
  if (data.length === 0) return null;

  const chartWidth = 100;
  const pad = 4;
  const chartH = height - 28;
  const step = (chartWidth - pad * 2) / (data.length - 1);

  // All 12 month positions for x-axis
  const allPoints = data.map((d, i) => ({
    x: pad + i * step,
    y: chartH - (d.rate / 100) * (chartH - 10) + 5,
    hasData: d.hasData !== false && d.rate > 0,
  }));

  // Only draw the line through months that have data
  const activePoints = allPoints.filter(p => p.hasData);

  let pathD = '';
  let fillD = '';
  if (activePoints.length >= 2) {
    pathD = `M ${activePoints[0].x} ${activePoints[0].y}`;
    for (let i = 1; i < activePoints.length; i++) {
      const prev = activePoints[i - 1];
      const curr = activePoints[i];
      const cpx1 = prev.x + (curr.x - prev.x) * 0.4;
      const cpx2 = curr.x - (curr.x - prev.x) * 0.4;
      pathD += ` C ${cpx1} ${prev.y}, ${cpx2} ${curr.y}, ${curr.x} ${curr.y}`;
    }
    fillD = pathD + ` L ${activePoints[activePoints.length - 1].x} ${chartH} L ${activePoints[0].x} ${chartH} Z`;
  } else if (activePoints.length === 1) {
    // Single point — draw a tiny horizontal line so it's visible
    pathD = `M ${activePoints[0].x - 2} ${activePoints[0].y} L ${activePoints[0].x + 2} ${activePoints[0].y}`;
  }

  const yLabels = ['100%', '75%', '50%', '25%', '0%'];

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ width: 30, justifyContent: 'space-between', height: chartH, paddingVertical: 1 }}>
          {yLabels.map((l, i) => (
            <Text key={i} style={{ fontSize: 8, color: textColor, textAlign: 'right' }}>{l}</Text>
          ))}
        </View>
        <View style={{ flex: 1, height: chartH, borderRadius: 6, overflow: 'hidden', marginLeft: 4 }}>
          <Svg width="100%" height={chartH} viewBox={`0 0 ${chartWidth} ${chartH}`} preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#EA580C" />
                <Stop offset="0.5" stopColor="#F59E0B" />
                <Stop offset="1" stopColor="#FACC15" />
              </LinearGradient>
              <LinearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#F59E0B" stopOpacity="0.15" />
                <Stop offset="1" stopColor="#F59E0B" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            {/* Grid lines at 25% intervals */}
            {[0.25, 0.5, 0.75].map((frac, i) => (
              <Path key={i} d={`M 0 ${chartH * (1 - frac)} H ${chartWidth}`} stroke={textColor + '12'} strokeWidth="0.3" />
            ))}
            {/* Fill area */}
            {fillD ? <Path d={fillD} fill="url(#areaFill)" /> : null}
            {/* Gradient line */}
            {pathD ? <Path d={pathD} stroke="url(#lineGrad)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
          </Svg>
        </View>
      </View>
      <View style={{ flexDirection: 'row', marginLeft: 34, marginTop: 4 }}>
        {data.map((d, i) => (
          <Text key={i} style={{ flex: 1, fontSize: 8, color: textColor, textAlign: 'center' }}>
            {d.month}
          </Text>
        ))}
      </View>
    </View>
  );
}

export default function AnalyticsScreen() {
  const { theme, isDark } = useTheme();
  const { profile: cachedProfile } = useProfile();
  const dateRange = DEFAULT_DAYS;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [streak, setStreak] = useState(0);
  const [displayName, setDisplayName] = useState('');
  const [weekDays, setWeekDays] = useState<any[]>([]);
  const [completionRate, setCompletionRate] = useState<any>({ started: 0, done: 0, missed: 0, due: 0, rate: 0 });
  const [comparison, setComparison] = useState<any[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<any[]>([]);
  const [trendFilter, setTrendFilter] = useState<'7d' | '30d' | '90d' | 'year'>('year');
  const [tagBreakdown, setTagBreakdown] = useState<any[]>([]);
  const [heatmapData, setHeatmapData] = useState<any>(null);
  const [heatmapFilter, setHeatmapFilter] = useState<{ type: '7d' | 'month' | 'year'; month?: number; year?: number }>({ type: '7d' });
  const [tappedCell, setTappedCell] = useState<{ row: number; col: number } | null>(null);
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const [shareVisible, setShareVisible] = useState(false);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const openShare = (data: ShareData) => {
    setShareData(data);
    setShareVisible(true);
  };

  const getWeekRange = () => {
    const now = new Date();
    const day = now.getDay();
    const sun = new Date(now);
    sun.setDate(now.getDate() - day);
    const sat = new Date(sun);
    sat.setDate(sun.getDate() + 6);
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${fmt(sun)} – ${fmt(sat)}, ${now.getFullYear()}`;
  };

  const getBestDay = () => {
    if (!weekDays.length) return 'N/A';
    const best = weekDays.reduce((a, b) => (b.completed > a.completed ? b : a), weekDays[0]);
    return best?.label || 'N/A';
  };

  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [s, wd, cr, comp, mt, tb, hm] = await Promise.all([
        getStreak(user.id),
        getWeekDayStatus(user.id),
        getCompletionRate(user.id, dateRange),
        getComparisonData(user.id),
        getMonthlyTrend(user.id, trendFilter),
        getTagBreakdown(user.id, dateRange),
        getProductivityHeatmap(user.id, heatmapFilter),
      ]);
      // Fetch profile separately (may not exist)
      try {
        const prof = await getProfile(user.id);
        if (prof?.display_name) setDisplayName(prof.display_name);
      } catch {}
      setStreak(s);
      setWeekDays(wd);
      setCompletionRate(cr);
      setComparison(comp);
      setMonthlyTrend(mt);
      setTagBreakdown(tb);
      setHeatmapData(hm);
    } catch (e: any) {
      console.error('Analytics error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [trendFilter, heatmapFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const now = new Date();
  const monthYear = now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  const st = makeStyles(theme, isDark);

  // Tag data for multi-segment donut — filter by focus tags in focused mode
  const focusedBreakdown = cachedProfile?.app_mode === 'focused' && cachedProfile.focus_tags?.length
    ? tagBreakdown.filter((t) => cachedProfile.focus_tags!.includes(t.tag))
    : tagBreakdown;
  const tagTotal = focusedBreakdown.reduce((sum, t) => sum + t.completed, 0);
  const tagSegments = focusedBreakdown
    .filter((t) => t.completed > 0)
    .map((t) => ({
      tag: t.tag,
      color: t.color,
      completed: t.completed,
      percentage: tagTotal > 0 ? Math.round((t.completed / tagTotal) * 100) : 0,
    }));

  // Ensure percentages sum to 100
  if (tagSegments.length > 0) {
    const sum = tagSegments.reduce((a, b) => a + b.percentage, 0);
    if (sum !== 100 && sum > 0) {
      tagSegments[0].percentage += (100 - sum);
    }
  }

  return (
    <View style={st.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={theme.primary} />
        }
      >
        {/* ===== HEADER ===== */}
        <View style={st.header}>
          <Text style={st.title}>Analytics</Text>
          <View style={st.headerRight}>
            <Text style={st.calendarIcon}>📅</Text>
            <Text style={st.dateLabel}>{monthYear}</Text>
            <Text style={st.dropdownArrow}>▾</Text>
          </View>
        </View>

        {/* ===== STREAK CARD ===== */}
        <View style={st.streakCard}>
          <Image source={STREAK_ASSETS.fire} style={st.streakFireIcon} resizeMode="contain" />
          <View style={st.streakTextCol}>
            <View style={st.streakTopRow}>
              <Text style={st.streakNumber}>{streak}</Text>
              <Text style={st.streakDayLabel}> day streak!</Text>
            </View>
            <Text style={st.streakSub}>Start your streak today{displayName ? `, ${displayName}` : ''}!</Text>
          </View>
          <TouchableOpacity
            hitSlop={10}
            onPress={() => openShare({ type: 'streak', streak, completionRate: completionRate.rate, totalDone: completionRate.done })}
          >
            <Image source={SHARE_ICON} style={{ width: 20, height: 20, tintColor: theme.textSecondary }} />
          </TouchableOpacity>
        </View>

        {/* ===== COMPLETION RATE ===== */}
        <View style={st.completionCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={st.sectionTitle}>Completion Rate</Text>
            <TouchableOpacity
              hitSlop={10}
              onPress={() => openShare({
                type: 'weekly_stats',
                streak,
                completionRate: completionRate.rate,
                done: completionRate.done,
                missed: completionRate.missed,
                bestDay: getBestDay(),
                weekRange: getWeekRange(),
                displayName,
              })}
            >
              <Image source={SHARE_ICON} style={{ width: 18, height: 18, tintColor: theme.textSecondary }} />
            </TouchableOpacity>
          </View>
          <View style={st.completionBody}>
            <DonutChart
              percentage={completionRate.rate}
              size={100}
              strokeWidth={10}
              color={theme.primary}
              bgColor={theme.momentumBarEmpty}
              useGradient
              textColor={theme.textPrimary}
            />
            <View style={st.completionStats}>
              <View style={st.completionStat}>
                <Text style={st.statNum}>{completionRate.started}</Text>
                <Text style={st.statLabel}>Started</Text>
              </View>
              <View style={st.completionStat}>
                <Text style={st.statNum}>{completionRate.done}</Text>
                <Text style={st.statLabel}>Done</Text>
              </View>
              <View style={st.completionStat}>
                <Text style={st.statNum}>{completionRate.missed}</Text>
                <Text style={st.statLabel}>Missed</Text>
              </View>
              <View style={st.completionStat}>
                <Text style={st.statNum}>{completionRate.due}</Text>
                <Text style={st.statLabel}>Due</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ===== COMPARISON ===== */}
        <View style={st.compCard}>
          <Text style={st.sectionTitle}>Comparison</Text>
          {[0, 2, 4].map((pairStart, pairIdx) => {
            const c1 = theme.primary;
            const c2 = theme.primary + '90';
            return (
              <View key={pairIdx} style={pairIdx > 0 ? st.compPairGap : undefined}>
                {comparison.slice(pairStart, pairStart + 2).map((item, j) => {
                  const pct = Math.max(item.rate, 1);
                  return (
                    <View key={j} style={st.compItem}>
                      <View style={st.compLabelRow}>
                        <Text style={st.compLabel}>{item.label}</Text>
                        <Text style={st.compRate}>{item.rate}%</Text>
                      </View>
                      <View style={st.compBarTrack}>
                        <View style={[st.compBarFill, { width: `${pct}%` }]}>
                          <Svg width="100%" height={8}>
                            <Defs>
                              <LinearGradient id={`cg${pairIdx}${j}`} x1="0%" y1="0%" x2="100%" y2="0%">
                                <Stop offset="0%" stopColor={c1} />
                                <Stop offset="100%" stopColor={c2} />
                              </LinearGradient>
                            </Defs>
                            <Path d="M0,0 H9999 V8 H0 Z" fill={`url(#cg${pairIdx}${j})`} />
                          </Svg>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>

        {/* ===== MOMENTUM TREND ===== */}
        <View style={st.card}>
          <View style={st.momentumHeader}>
            <Text style={st.sectionTitle}>Momentum Trend</Text>
            {monthlyTrend.length > 0 && (() => {
              const withData = monthlyTrend.filter((m: any) => m.rate > 0);
              const avg = withData.length > 0 ? Math.round(withData.reduce((s: number, m: any) => s + m.rate, 0) / withData.length) : 0;
              return (
                <View style={st.avgBadge}>
                  <Text style={st.avgLabel}>AVG</Text>
                  <Text style={st.avgValue}>{avg}%</Text>
                </View>
              );
            })()}
          </View>
          <View style={st.trendFilterRow}>
            {([
              { key: '7d', label: '7 Days' },
              { key: '30d', label: '30 Days' },
              { key: '90d', label: '90 Days' },
              { key: 'year', label: 'Year' },
            ] as { key: '7d' | '30d' | '90d' | 'year'; label: string }[]).map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[st.trendFilterTab, trendFilter === opt.key && st.trendFilterTabActive]}
                onPress={() => setTrendFilter(opt.key)}
              >
                <Text style={[st.trendFilterText, trendFilter === opt.key && st.trendFilterTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <LineChart
            data={monthlyTrend}
            height={140}
            textColor={theme.textTertiary}
          />
        </View>

        {/* ===== TASKS BY TAG BEHAVIOUR ===== */}
        <View style={st.card}>
          <Text style={st.sectionTitle}>Tasks by Tag Behaviour</Text>
          <View style={st.tagBody}>
            {/* Multi-segment donut with % labels */}
            <View style={st.tagDonutWrap}>
              {tagSegments.length > 0 ? (
                <MultiDonut
                  segments={tagSegments}
                  size={110}
                  strokeWidth={14}
                  bgColor={theme.momentumBarEmpty}
                  centerLabel="100%"
                  textColor={theme.textPrimary}
                />
              ) : (
                <DonutChart
                  percentage={0}
                  size={110}
                  strokeWidth={14}
                  color={theme.textTertiary}
                  bgColor={theme.momentumBarEmpty}
                />
              )}
            </View>
            {/* Legend */}
            <View style={st.tagLegendCol}>
              {tagSegments.map((t: any, i: number) => (
                <View key={i} style={st.tagLegendRow}>
                  <View style={[st.tagLegendDot, { backgroundColor: t.color }]} />
                  <Text style={st.tagLegendText} numberOfLines={1}>{t.tag}</Text>
                </View>
              ))}
              {tagSegments.length === 0 && (
                <Text style={{ color: theme.textTertiary, fontSize: 12 }}>No completed tasks yet</Text>
              )}
            </View>
          </View>
        </View>

        {/* ===== PEAK PRODUCTIVITY TIMES ===== */}
        <View style={st.card}>
          <Text style={st.sectionTitle}>Peak Productivity Times</Text>

          {/* Heatmap filters */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.heatmapFilterScroll}>
            {/* Last 7 Days */}
            <TouchableOpacity
              style={[st.heatmapFilterTab, heatmapFilter.type === '7d' && st.heatmapFilterTabActive]}
              onPress={() => { setHeatmapFilter({ type: '7d' }); setTappedCell(null); }}
            >
              <Text style={[st.heatmapFilterText, heatmapFilter.type === '7d' && st.heatmapFilterTextActive]}>7 Days</Text>
            </TouchableOpacity>
            {/* Month pills */}
            {monthNames.map((name, idx) => {
              const isActive = heatmapFilter.type === 'month' && heatmapFilter.month === idx && (heatmapFilter.year ?? new Date().getFullYear()) === new Date().getFullYear();
              return (
                <TouchableOpacity
                  key={idx}
                  style={[st.heatmapFilterTab, isActive && st.heatmapFilterTabActive]}
                  onPress={() => { setHeatmapFilter({ type: 'month', month: idx, year: new Date().getFullYear() }); setTappedCell(null); }}
                >
                  <Text style={[st.heatmapFilterText, isActive && st.heatmapFilterTextActive]}>{name}</Text>
                </TouchableOpacity>
              );
            })}
            {/* Year pills — current year and previous */}
            {[new Date().getFullYear(), new Date().getFullYear() - 1].map((yr) => {
              const isActive = heatmapFilter.type === 'year' && heatmapFilter.year === yr;
              return (
                <TouchableOpacity
                  key={yr}
                  style={[st.heatmapFilterTab, isActive && st.heatmapFilterTabActive]}
                  onPress={() => { setHeatmapFilter({ type: 'year', year: yr }); setTappedCell(null); }}
                >
                  <Text style={[st.heatmapFilterText, isActive && st.heatmapFilterTextActive]}>{yr}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {heatmapData && (
            <View style={{ marginTop: 10 }}>
              {/* Time slot headers */}
              <View style={{ flexDirection: 'row', marginLeft: 36, marginBottom: 6 }}>
                {heatmapData.timeSlots.map((slot: string, i: number) => (
                  <Text key={i} style={st.heatmapColLabel}>{slot}</Text>
                ))}
              </View>
              {/* Rows */}
              {heatmapData.dayLabels.map((day: string, rowIdx: number) => (
                <View key={rowIdx} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
                  <Text style={st.heatmapRowLabel}>{day}</Text>
                  {heatmapData.heatmap[rowIdx].map((count: number, colIdx: number) => {
                    const intensity = heatmapData.maxCount > 0 ? count / heatmapData.maxCount : 0;
                    let bgColor = isDark ? '#1A1A24' : '#F0F0F4';
                    if (intensity > 0.75) bgColor = theme.primary;
                    else if (intensity > 0.5) bgColor = theme.primary + 'B0';
                    else if (intensity > 0.25) bgColor = theme.primary + '60';
                    else if (intensity > 0) bgColor = theme.primary + '30';
                    const isTapped = tappedCell?.row === rowIdx && tappedCell?.col === colIdx;
                    return (
                      <TouchableOpacity
                        key={colIdx}
                        activeOpacity={0.7}
                        style={[st.heatmapCell, { backgroundColor: bgColor }]}
                        onPress={() => setTappedCell(isTapped ? null : { row: rowIdx, col: colIdx })}
                      >
                        {isTapped && (
                          <View style={st.heatmapOverlay}>
                            <Text style={st.heatmapOverlayText}>{count}</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ===== SHARE MY WEEK ===== */}
        <TouchableOpacity
          style={st.shareWeekBtn}
          activeOpacity={0.8}
          onPress={() => openShare({
            type: 'weekly_stats',
            streak,
            completionRate: completionRate.rate,
            done: completionRate.done,
            missed: completionRate.missed,
            bestDay: getBestDay(),
            weekRange: getWeekRange(),
            displayName,
          })}
        >
          <Image source={SHARE_ICON} style={{ width: 18, height: 18, tintColor: '#FFFFFF' }} />
          <Text style={st.shareWeekText}>Share My Week</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {shareData && (
        <ShareModal
          visible={shareVisible}
          onClose={() => { setShareVisible(false); setShareData(null); }}
          data={shareData}
          displayName={displayName}
        />
      )}
    </View>
  );
}

const makeStyles = (t: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },

  // ===== HEADER =====
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 12,
  },
  title: { fontSize: 28, fontWeight: '800', color: t.textPrimary },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  calendarIcon: { fontSize: 16 },
  dateLabel: { fontSize: 13, color: t.textSecondary, fontWeight: '600' },
  dropdownArrow: { color: t.textTertiary, fontSize: 12 },

  // ===== CARDS =====
  card: {
    marginHorizontal: 20,
    backgroundColor: t.cardBg,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: t.cardBorder,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: t.textPrimary },

  // ===== STREAK =====
  streakCard: {
    marginHorizontal: 20,
    backgroundColor: isDark ? '#1C1A2E' : '#FFF8F0',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(251,146,60,0.12)' : 'rgba(251,146,60,0.2)',
  },
  streakFireIcon: {
    width: 32,
    height: 32,
    marginRight: 12,
  },
  streakTextCol: {
    flex: 1,
  },
  streakTopRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  streakNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: t.primary,
  },
  streakDayLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: t.textPrimary,
  },
  streakSub: {
    fontSize: 12,
    color: t.textTertiary,
    marginTop: 2,
  },

  // ===== COMPLETION RATE =====
  completionCard: {
    marginHorizontal: 20,
    backgroundColor: t.cardBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: t.cardBorder,
  },
  completionBody: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    gap: 16,
  },
  completionStats: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
  },
  completionStat: { alignItems: 'center', width: '45%' },
  statNum: { fontSize: 18, fontWeight: '800', color: t.textPrimary },
  statLabel: { fontSize: 11, color: t.textTertiary, marginTop: 2, fontWeight: '600' },

  // ===== COMPARISON =====
  compCard: {
    marginHorizontal: 20,
    backgroundColor: t.cardBg,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: t.cardBorder,
  },
  compPairGap: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
  },
  compItem: {
    marginTop: 10,
  },
  compLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  compLabel: { fontSize: 12, color: t.textSecondary, fontWeight: '600' },
  compBarTrack: {
    height: 8,
    backgroundColor: t.momentumBarEmpty,
    borderRadius: 4,
    overflow: 'hidden',
  },
  compBarFill: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  compRate: { fontSize: 10, color: t.textTertiary, fontWeight: '600' },

  // ===== MOMENTUM TREND =====
  momentumHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  avgBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  avgLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: t.textTertiary,
    letterSpacing: 0.5,
  },
  avgValue: {
    fontSize: 14,
    fontWeight: '700',
    color: t.textPrimary,
  },

  // ===== TREND FILTER =====
  trendFilterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  trendFilterTab: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
  },
  trendFilterTabActive: {
    backgroundColor: t.primary,
  },
  trendFilterText: {
    fontSize: 10,
    fontWeight: '600',
    color: t.textTertiary,
  },
  trendFilterTextActive: {
    color: '#fff',
  },

  // ===== TAG LEGEND =====
  tagBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    gap: 12,
  },
  tagDonutWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagLegendCol: {
    flex: 1,
    paddingLeft: 4,
  },
  tagLegendRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
  tagLegendDot: { width: 8, height: 8, borderRadius: 4 },
  tagLegendText: { fontSize: 10, color: t.textSecondary, fontWeight: '500', flex: 1 },

  // ===== HEATMAP =====
  heatmapFilterScroll: {
    marginTop: 10,
    marginBottom: 4,
  },
  heatmapFilterTab: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
    marginRight: 6,
  },
  heatmapFilterTabActive: {
    backgroundColor: t.primary,
  },
  heatmapFilterText: {
    fontSize: 10,
    fontWeight: '600',
    color: t.textTertiary,
  },
  heatmapFilterTextActive: {
    color: '#fff',
  },
  heatmapColLabel: { flex: 1, fontSize: 7, color: t.textTertiary, textAlign: 'center', fontWeight: '600' },
  heatmapRowLabel: { width: 32, fontSize: 9, color: t.textTertiary, fontWeight: '600' },
  heatmapCell: {
    flex: 1,
    height: 26,
    marginHorizontal: 1.5,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heatmapOverlay: {
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  heatmapOverlayText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  shareWeekBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    backgroundColor: t.primary,
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
    marginTop: 4,
  },
  shareWeekText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
