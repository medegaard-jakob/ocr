import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import AssignDriverScreen from '../screens/AssignDriverScreen';
import DispatchScreen from '../screens/DispatchScreen';
import HistoryScreen from '../screens/HistoryScreen';
import HomeScreen from '../screens/HomeScreen';
import ResultScreen from '../screens/ResultScreen';
import ScannerScreen from '../screens/ScannerScreen';
import { colors } from '../lib/theme';
import type { RootStackParamList } from '../types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.bg,
    text: colors.textPrimary,
    border: colors.border,
    primary: colors.accent,
  },
};

export default function RootNavigator() {
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.textPrimary,
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Scanner" component={ScannerScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Result" component={ResultScreen} options={{ title: 'Scan result' }} />
        <Stack.Screen name="Dispatch" component={DispatchScreen} options={{ title: 'Transportation order' }} />
        <Stack.Screen name="AssignDriver" component={AssignDriverScreen} options={{ title: 'Driver team' }} />
        <Stack.Screen name="History" component={HistoryScreen} options={{ title: 'Driver overview' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
