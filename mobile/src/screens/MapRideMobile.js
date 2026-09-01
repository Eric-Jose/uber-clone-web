import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Alert } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';

const MapRideMobile = ({ navigation }) => {
  const [location, setLocation] = useState(null);
  const [destination, setDestination] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [drivers, setDrivers] = useState([
    {
      id: 1,
      name: 'Carlos Silva',
      rating: 4.9,
      distance: '2.3 km',
      eta: '5 min',
      car: 'Honda Civic',
      plate: 'ABC-1234',
      latitude: -23.5505,
      longitude: -46.6333
    },
    {
      id: 2,
      name: 'Maria Santos',
      rating: 4.8,
      distance: '3.1 km',
      eta: '7 min',
      car: 'Toyota Corolla',
      plate: 'XYZ-5678',
      latitude: -23.5550,
      longitude: -46.6300
    }
  ]);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão Negada', 'Permitir acesso à localização para usar o app');
        return;
      }

      let loc = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05
      });
    })();
  }, []);

  const handleRequestRide = (driver) => {
    Alert.alert(
      '🚗 Confirmar Corrida',
      `Solicitar corrida com ${driver.name}?\n${driver.car} - ${driver.plate}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: () => {
            Alert.alert('✅ Sucesso', 'Corrida solicitada! Motorista a caminho.');
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      {location && (
        <MapView
          style={styles.map}
          initialRegion={location}
        >
          {/* Marcador do usuário */}
          <Marker
            coordinate={{
              latitude: location.latitude,
              longitude: location.longitude
            }}
            title="Sua Localização"
            pinColor="blue"
          />

          {/* Marcadores dos motoristas */}
          {drivers.map(driver => (
            <Marker
              key={driver.id}
              coordinate={{
                latitude: driver.latitude,
                longitude: driver.longitude
              }}
              title={driver.name}
              description={`${driver.rating}⭐ - ${driver.distance}`}
            />
          ))}
        </MapView>
      )}

      {/* Painel de Motoristas */}
      <View style={styles.driversPanel}>
        <Text style={styles.title}>Motoristas Disponíveis</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {drivers.map(driver => (
            <TouchableOpacity
              key={driver.id}
              style={styles.driverCard}
              onPress={() => handleRequestRide(driver)}
            >
              <View style={styles.driverHeader}>
                <Text style={styles.driverName}>{driver.name}</Text>
                <Text style={styles.rating}>⭐ {driver.rating}</Text>
              </View>
              <Text style={styles.carInfo}>{driver.car}</Text>
              <Text style={styles.distance}>📏 {driver.distance} • {driver.eta}</Text>
              <TouchableOpacity style={styles.btnRequest}>
                <Text style={styles.btnText}>Solicitar</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff'
  },
  map: {
    flex: 1
  },
  driversPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    color: '#333'
  },
  driverCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 12,
    marginRight: 10,
    minWidth: 220,
    borderWidth: 2,
    borderColor: '#eee'
  },
  driverHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  driverName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333'
  },
  rating: {
    fontSize: 12,
    color: '#ff9800'
  },
  carInfo: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4
  },
  distance: {
    fontSize: 11,
    color: '#999',
    marginBottom: 10
  },
  btnRequest: {
    backgroundColor: '#667eea',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center'
  },
  btnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12
  }
});

export default MapRideMobile;
