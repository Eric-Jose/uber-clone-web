import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { restoreSession, logout } from './src/services/mobileApi';

import LoginMobile from './src/screens/LoginMobile';
import RegisterMobile from './src/screens/RegisterMobile';
import ProfileMobile from './src/screens/ProfileMobile';
import MapRideMobile from './src/screens/MapRideMobile';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const theme = {
  background: '#090909',
  surface: '#151515',
  orange: '#ff6a00',
  text: '#ffffff',
  muted: '#a5a5a5'
};

function HistoryScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>Histórico</Text>
      <Text style={{ color: theme.muted, marginTop: 8 }}>Suas corridas aparecerão aqui.</Text>
    </View>
  );
}

function PromotionsScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>Promoções</Text>
      <Text style={{ color: theme.muted, marginTop: 8 }}>Confira suas ofertas no PreçoFixo17.</Text>
    </View>
  );
}

function SupportScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>Suporte</Text>
      <Text style={{ color: theme.muted, marginTop: 8 }}>Central de ajuda do PreçoFixo17.</Text>
    </View>
  );
}

function MainTabs({ onLogout }) {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: theme.surface, borderTopColor: '#242424', height: 64, paddingBottom: 7, paddingTop: 6 },
        tabBarActiveTintColor: theme.orange,
        tabBarInactiveTintColor: '#777'
      }}
    >
      <Tab.Screen name="Home" component={MapRideMobile} options={{ tabBarLabel: 'Início', tabBarIcon: () => <Text>⌂</Text> }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ tabBarLabel: 'Corridas', tabBarIcon: () => <Text>▤</Text> }} />
      <Tab.Screen name="Promotions" component={PromotionsScreen} options={{ tabBarLabel: 'Ofertas', tabBarIcon: () => <Text>◆</Text> }} />
      <Tab.Screen name="Support" component={SupportScreen} options={{ tabBarLabel: 'Ajuda', tabBarIcon: () => <Text>?</Text> }} />
      <Tab.Screen name="Profile" component={ProfileMobile} initialParams={{ onLogout }} options={{ tabBarLabel: 'Perfil', tabBarIcon: () => <Text>●</Text> }} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => {
    let mounted = true;
    restoreSession().then((restored) => {
      if (mounted) {
        setSession(restored);
        setBooting(false);
      }
    });
    return () => { mounted = false; };
  }, []);

  const handleLoggedIn = (data) => setSession(data);
  const handleLogout = async () => {
    await logout();
    setSession(null);
  };

  if (booting) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: theme.orange, fontSize: 28, fontWeight: '900' }}>17</Text>
        <Text style={{ color: theme.text, fontSize: 20, fontWeight: '800', marginTop: 5 }}>PREÇOFIXO</Text>
        <ActivityIndicator color={theme.orange} size="large" style={{ marginTop: 22 }} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        {!session ? (
          <>
            <Stack.Screen name="Login">
              {(props) => <LoginMobile {...props} onLoggedIn={handleLoggedIn} />}
            </Stack.Screen>
            <Stack.Screen name="Register">
              {(props) => <RegisterMobile {...props} onRegistered={handleLoggedIn} />}
            </Stack.Screen>
          </>
        ) : (
          <Stack.Screen name="Main">
            {(props) => <MainTabs {...props} onLogout={handleLogout} />}
          </Stack.Screen>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
