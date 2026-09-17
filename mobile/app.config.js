export default ({ config }) => {
  const webAppUrl = process.env.EXPO_PUBLIC_WEB_APP_URL || 'https://uber-clone-web.vercel.app/';

  return {
    ...config,
    name: 'PreçoFixo17',
    slug: 'precofixo17',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark',
    scheme: 'precofixo17',
    ios: {
      ...(config.ios || {}),
      supportsTablet: false,
      bundleIdentifier: 'com.precofixo17.app',
      infoPlist: {
        ...(config.ios?.infoPlist || {}),
        NSLocationWhenInUseUsageDescription: 'O PreçoFixo17 usa sua localização para encontrar você e acompanhar a corrida.',
        NSLocationAlwaysAndWhenInUseUsageDescription: 'O PreçoFixo17 usa sua localização em segundo plano para manter a corrida atualizada.',
        UIBackgroundModes: ['location'],
      },
    },
    android: {
      ...(config.android || {}),
      package: 'com.precofixo17.app',
      versionCode: 1,
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ff6a00',
      },
      permissions: [
        'ACCESS_COARSE_LOCATION',
        'ACCESS_FINE_LOCATION',
        'ACCESS_BACKGROUND_LOCATION',
        'FOREGROUND_SERVICE',
        'FOREGROUND_SERVICE_LOCATION',
      ],
      splash: {
        ...(config.android?.splash || {}),
        backgroundColor: '#000000',
      },
    },
    plugins: [
      ...(config.plugins || []).filter((plugin) => plugin !== 'expo-location' && !(Array.isArray(plugin) && plugin[0] === 'expo-location')),
      ['expo-location', {
        locationAlwaysAndWhenInUsePermission: 'O PreçoFixo17 usa sua localização em segundo plano para manter a corrida atualizada.',
        isIosBackgroundLocationEnabled: true,
      }],
    ],
    extra: {
      ...(config.extra || {}),
      webAppUrl,
      backendUrl: webAppUrl.replace(/\/$/, ''),
    },
  };
};
