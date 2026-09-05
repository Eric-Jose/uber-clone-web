import React, { useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, BackHandler, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const WEB_APP_URL = 'https://uber-clone-web.vercel.app/';

export default function App() {
  const webViewRef = useRef(null);
  const lastUrl = useRef(WEB_APP_URL);

  const handleNavigation = useCallback((event) => {
    lastUrl.current = event.nativeEvent.url;
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
          cacheEnabled={false}
          incognito={false}
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          setSupportMultipleWindows={false}
          onNavigationStateChange={handleNavigation}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loading}>
              <Text style={styles.brand17}>17</Text>
              <Text style={styles.brand}>PREÇOFIXO17</Text>
              <ActivityIndicator color="#ff6a00" size="large" style={styles.spinner} />
            </View>
          )}
          onError={() => {
            webViewRef.current?.reload();
          }}
        />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#090909' },
  webview: { flex: 1, backgroundColor: '#090909' },
  loading: { ...StyleSheet.absoluteFillObject, backgroundColor: '#090909', alignItems: 'center', justifyContent: 'center' },
  brand17: { color: '#ff6a00', fontSize: 42, fontWeight: '900' },
  brand: { color: '#fff', fontSize: 23, fontWeight: '900', letterSpacing: 2, marginTop: 6 },
  spinner: { marginTop: 24 }
});
