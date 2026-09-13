import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { WebView } from 'react-native-webview';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const WEB_APP_URL = process.env.EXPO_PUBLIC_WEB_APP_URL || 'https://uber-clone-web.vercel.app/';
const API_BASE_URL = WEB_APP_URL.replace(/\/$/, '');
const LOCATION_TASK_NAME = 'precofixo17-background-location';
const AUTH_STORAGE_KEY = '@precofixo17/native-auth';

async function readNativeAuth() {
  try {
    const saved = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch (_) {
    return null;
  }
}

if (!TaskManager.isTaskDefined(LOCATION_TASK_NAME)) {
  TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
    if (error) return;
    const locations = Array.isArray(data?.locations) ? data.locations : [];
    const lastLocation = locations[locations.length - 1];
    const latitude = Number(lastLocation?.coords?.latitude);
    const longitude = Number(lastLocation?.coords?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    const auth = await readNativeAuth();
    if (!auth?.token || !auth?.user?.uid) return;
    const headers = { Authorization: `Bearer ${auth.token}` };
    const location = { lat: latitude, lng: longitude };

    try {
      if (auth.user.userType === 'driver') {
        await axios.post(`${API_BASE_URL}/api/drivers/${encodeURIComponent(auth.user.uid)}/status`, {
          isOnline: true,
          currentLocation: location,
        }, { headers, timeout: 10000 });
        return;
      }

      const activeResponse = await axios.get(`${API_BASE_URL}/api/rides/active`, { headers, timeout: 10000 });
      const ride = activeResponse.data?.ride;
      if (ride?.id) {
        await axios.post(`${API_BASE_URL}/api/rides/${encodeURIComponent(ride.id)}/passenger-location`, {
          location,
        }, { headers, timeout: 10000 });
      }
    } catch (_) {
      // A temporary network failure is expected while the phone changes signal.
    }
  });
}

async function stopBackgroundLocation() {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
  } catch (_) {}
}

async function startBackgroundLocation() {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') return false;

  let background = await Location.getBackgroundPermissionsAsync();
  if (background.status !== 'granted') {
    background = await Location.requestBackgroundPermissionsAsync();
  }
  if (background.status !== 'granted') return false;

  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (!alreadyStarted) {
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.High,
      timeInterval: 5000,
      distanceInterval: 10,
      deferredUpdatesInterval: 5000,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'PreçoFixo17 ativo',
        notificationBody: 'A localização está sendo atualizada para manter sua corrida segura.',
        notificationColor: '#ff6a00',
      },
    });
  }
  return true;
}

const AUTH_BRIDGE_SCRIPT = `
(function () {
  function sendAuth() {
    try {
      if (!window.ReactNativeWebView) return;
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'pf17-auth',
        token: localStorage.getItem('token'),
        user: JSON.parse(localStorage.getItem('user') || 'null')
      }));
    } catch (_) {}
  }
  sendAuth();
  window.setInterval(sendAuth, 5000);
})();
true;
`;

export default function App() {
  const webViewRef = useRef(null);
  const trackingRef = useRef(false);
  const trackingRequestRef = useRef(null);
  const [tracking, setTracking] = useState(false);

  const handleNavigation = useCallback(() => {}, []);

  const handleWebMessage = useCallback(async (event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data || '{}');
      if (message.type !== 'pf17-auth') return;
      if (!message.token || !message.user?.uid) {
        await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
        await stopBackgroundLocation();
        trackingRef.current = false;
        setTracking(false);
        return;
      }
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token: message.token, user: message.user }));
      if (trackingRef.current || trackingRequestRef.current) return;
      trackingRequestRef.current = startBackgroundLocation();
      try {
        const started = await trackingRequestRef.current;
        trackingRef.current = started;
        setTracking(started);
      } finally {
        trackingRequestRef.current = null;
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    const onBack = () => {
      if (webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => subscription.remove();
  }, []);

  useEffect(() => () => { void stopBackgroundLocation(); }, []);

  return (
    <SafeAreaProvider style={styles.root}>
      <View style={styles.root}>
        <WebView
          ref={webViewRef}
          source={{ uri: WEB_APP_URL }}
          style={styles.webview}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          geolocationEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          cacheEnabled
          incognito={false}
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          setSupportMultipleWindows={false}
          injectedJavaScript={AUTH_BRIDGE_SCRIPT}
          onMessage={handleWebMessage}
          onNavigationStateChange={handleNavigation}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loading}>
              <Text style={styles.brand17}>17</Text>
              <Text style={styles.brand}>PREÇOFIXO17</Text>
              <ActivityIndicator color="#ff6a00" size="large" style={styles.spinner} />
            </View>
          )}
          renderError={() => (
            <View style={styles.loading}>
              <Text style={styles.errorTitle}>Sem conexão</Text>
              <Text style={styles.errorText}>Verifique a internet e tente novamente.</Text>
              <Text style={styles.retry} onPress={() => webViewRef.current?.reload()}>Tentar novamente</Text>
            </View>
          )}
        />
        {tracking && <View pointerEvents="none" style={styles.trackingBadge}><Text style={styles.trackingText}>GPS ativo</Text></View>}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#090909' },
  webview: { flex: 1, backgroundColor: '#090909' },
  loading: { ...StyleSheet.absoluteFillObject, backgroundColor: '#090909', alignItems: 'center', justifyContent: 'center', padding: 24 },
  brand17: { color: '#ff6a00', fontSize: 42, fontWeight: '900' },
  brand: { color: '#fff', fontSize: 23, fontWeight: '900', letterSpacing: 2, marginTop: 6 },
  spinner: { marginTop: 24 },
  errorTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  errorText: { color: '#9ca3af', marginTop: 10, textAlign: 'center' },
  retry: { color: '#ff6a00', fontWeight: '800', marginTop: 24, padding: 12 },
  trackingBadge: { position: 'absolute', right: 12, bottom: 16, backgroundColor: 'rgba(5,5,5,.88)', borderColor: '#ff6a00', borderWidth: 1, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 11 },
  trackingText: { color: '#fff', fontSize: 11, fontWeight: '800' },
});
