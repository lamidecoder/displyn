import { Tabs } from 'expo-router';
import { Image, StyleSheet } from 'react-native';
import { useTheme } from '../../lib/ThemeContext';

const icons = {
  today: require('../../assets/icons/tab-today.png'),
  analytics: require('../../assets/icons/tab-analytics.png'),
  tasks: require('../../assets/icons/tab-tasks.png'),
  insights: require('../../assets/icons/tab-insights.png'),
  profile: require('../../assets/icons/tab-profile.png'),
};

export default function TabLayout() {
  const { theme } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.tabBar,
          borderTopColor: theme.tabBarBorder,
          borderTopWidth: 1,
          height: 70,
          paddingBottom: 12,
          paddingTop: 8,
        },
        tabBarActiveTintColor: theme.tabActive,
        tabBarInactiveTintColor: theme.tabInactive,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color }) => (
            <Image source={icons.today} style={[s.icon, { tintColor: color }]} />
          ),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analytics',
          tabBarIcon: ({ color }) => (
            <Image source={icons.analytics} style={[s.icon, { tintColor: color }]} />
          ),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color }) => (
            <Image source={icons.tasks} style={[s.icon, { tintColor: color }]} />
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          tabBarIcon: ({ color }) => (
            <Image source={icons.insights} style={[s.icon, { tintColor: color }]} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <Image source={icons.profile} style={[s.icon, { tintColor: color }]} />
          ),
        }}
      />
      <Tabs.Screen name="explore" options={{ href: null }} />
      <Tabs.Screen name="stats" options={{ href: null }} />
    </Tabs>
  );
}

const s = StyleSheet.create({
  icon: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
  },
});
