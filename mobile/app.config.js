export default ({ config }) => ({
  ...config,
  name: 'PreçoFixo17',
  slug: 'precofixo17',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  scheme: 'precofixo17',
  ios: {
    ...(config.ios || {}),
    supportsTablet: false,
    bundleIdentifier: 'com.precofixo17.app',
    infoPlist: {
      ...(config.ios?.infoPlist || {}),
      NSLocationWhenInUseUsageDescription: 'O PreçoFixo17 usa sua localização para encontrar você e acompanhar a corrida.'
    }
  },
  android: {
    ...(config.android || {}),
    package: 'com.precofixo17.app',
    adaptiveIcon: {
      backgroundColor: '#ff6a00',
      foregroundImage: './assets/icon-foreground.png'
    },
    permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION']
  },
  plugins: [
    'expo-location'
  ],
  extra: {
    ...(config.extra || {}),
    backendUrl: 'https://uber-clone-backend-production.up.railway.app'
  }
});
