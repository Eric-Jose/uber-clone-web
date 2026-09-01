import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

// Screens
import LoginMobile from './screens/LoginMobile';
import ProfileMobile from './screens/ProfileMobile';
import MapRideMobile from './screens/MapRideMobile';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function HomeScreen() {
  return <MapRideMobile />;
}

function HistoryScreen() {
  return <Text>📜 Histórico</Text>;
}

function PromotionsScreen() {
  return <Text>🎁 Promoções</Text>;
}

function SupportScreen() {
  return <Text>❓ Suporte</Text>;
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#667eea',
        tabBarInactiveTintColor: '#ccc',
        headerShown: false
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: '🏠',
          tabBarShowLabel: false
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarLabel: '📜',
          tabBarShowLabel: false
        }}
      />
      <Tab.Screen
        name="Promotions"
        component={PromotionsScreen}
        options={{
          tabBarLabel: '🎁',
          tabBarShowLabel: false
        }}
      />
      <Tab.Screen
        name="Support"
        component={SupportScreen}
        options={{
          tabBarLabel: '❓',
          tabBarShowLabel: false
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileMobile}
        options={{
          tabBarLabel: '👤',
          tabBarShowLabel: false
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isLoggedIn ? (
          <Stack.Screen
            name="Login"
            component={LoginMobile}
            options={{ animationEnabled: false }}
          />
        ) : (
          <Stack.Screen name="Main" component={MainTabs} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
