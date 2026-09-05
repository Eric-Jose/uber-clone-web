import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { getActiveRide, requestRide, searchRide } from '../services/mobileApi';
import { connectSocket, disconnectSocket, joinRide, on } from '../services/mobileSocket';

const ORANGE = '#ff6a00';
const BG = '#090909';
const CARD = '#151515';

const toPoint = (value) => value ? { latitude: Number(value.latitude), longitude: Number(value.longitude) } : null;

export default function MapRideMobile() {
  const [location, setLocation] = useState(null);
  const [destination, setDestination] = useState(null);
  const [ride, setRide] = useState(null);
  const [requesting, setRequesting] = useState(false);
  const [message, setMessage] = useState('Toque e segure no mapa para escolher seu destino.');
  const [driverLocation, setDriverLocation] = useState(null);

  const origin = useMemo(() => location ? { latitude: location.latitude, longitude: location.longitude } : null, [location]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        if (mounted) setMessage('Ative a localização para pedir uma corrida.');
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (mounted) setLocation({ latitude: current.coords.latitude, longitude: current.coords.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 });

      try {
        const active = await getActiveRide();
        if (mounted && active?.ride) {
          setRide(active.ride);
          setDestination(toPoint(active.ride.destination));
          setMessage(active.ride.status === 'SEARCHING' ? 'Procurando motorista próximo...' : `Corrida ${active.ride.status}`);
          await joinRide(active.ride.id);
        }
      } catch (_) {
        // Sem corrida ativa é o estado normal para um usuário novo.
      }
      await connectSocket();
    })();

    return () => {
      mounted = false;
      disconnectSocket();
    };
  }, []);

  useEffect(() => {
    let offAccepted;
    let offLocation;
    let offCancelled;
    if (ride?.id) {
      joinRide(ride.id);
      offAccepted = on('ride-accepted', (data) => {
        if (String(data?.rideId || data?.ride?.id) !== String(ride.id)) return;
        setRide((current) => ({ ...current, ...(data.ride || data), status: 'ACCEPTED' }));
        setMessage(`Motorista encontrado: ${data?.driver?.name || data?.ride?.driverName || 'seu motorista'}`);
      });
      offLocation = on('update-driver-location', (data) => {
        if (String(data?.rideId) !== String(ride.id) || !data?.location) return;
        setDriverLocation(toPoint(data.location));
      });
      offCancelled = on('ride-cancelled', (data) => {
        if (String(data?.rideId) !== String(ride.id)) return;
        setRide((current) => ({ ...current, status: 'CANCELLED' }));
        setMessage('A corrida foi cancelada.');
      });
    }
    return () => {
      offAccepted?.();
      offLocation?.();
      offCancelled?.();
    };
  }, [ride?.id]);

  const handleMapLongPress = (event) => {
    if (ride && ['SEARCHING', 'ACCEPTED', 'IN_PROGRESS'].includes(ride.status)) return;
    const point = event.nativeEvent.coordinate;
    setDestination(point);
    setMessage('Destino selecionado. A corrida PreçoFixo17 custa R$ 17,00.');
  };

  const handleRequestRide = async () => {
    if (!origin || !destination) {
      Alert.alert('Escolha seu destino', 'Toque e segure em um ponto do mapa para selecionar o destino.');
      return;
    }
    if (ride && ['SEARCHING', 'ACCEPTED', 'IN_PROGRESS'].includes(ride.status)) return;

    try {
      setRequesting(true);
      setMessage('Enviando pedido...');
      const data = await requestRide(origin, destination);
      const createdRide = data?.ride || data;
      setRide(createdRide);
      await joinRide(createdRide.id);
      setMessage('Procurando motorista próximo...');
      try { await searchRide(createdRide.id); } catch (_) { /* o despacho já é iniciado pela criação */ }
    } catch (error) {
      Alert.alert('Não foi possível pedir', error.message || 'Tente novamente.');
      setMessage('Pronto para uma nova solicitação.');
    } finally {
      setRequesting(false);
    }
  };

  const resetRide = () => {
    setRide(null);
    setDestination(null);
    setDriverLocation(null);
    setMessage('Toque e segure no mapa para escolher seu destino.');
  };

  return (
    <View style={styles.container}>
      {location ? (
        <MapView
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={location}
          showsUserLocation
          showsMyLocationButton
          onLongPress={handleMapLongPress}
          rotateEnabled={false}
        >
          {destination && <Marker coordinate={destination} title="Destino" pinColor={ORANGE} />}
          {driverLocation && <Marker coordinate={driverLocation} title="Motorista" description="Atualização em tempo real" />}
          {destination && <Polyline coordinates={[origin, destination]} strokeWidth={4} strokeColor={ORANGE} />}
        </MapView>
      ) : (
        <View style={styles.loadingMap}><ActivityIndicator color={ORANGE} size="large" /><Text style={styles.loadingText}>Localizando você...</Text></View>
      )}

      <View style={styles.topBadge}><Text style={styles.badge17}>17</Text><View><Text style={styles.brand}>PREÇOFIXO17</Text><Text style={styles.badgeSub}>CORRIDAS POR R$ 17</Text></View></View>

      <View style={styles.bottomCard}>
        <Text style={styles.title}>Para onde vamos?</Text>
        <Text style={styles.message}>{message}</Text>

        {destination && !ride && (
          <View style={styles.priceRow}>
            <View><Text style={styles.priceLabel}>PREÇO FIXO</Text><Text style={styles.price}>R$ 17,00</Text></View>
            <TouchableOpacity style={[styles.requestButton, requesting && styles.disabled]} onPress={handleRequestRide} disabled={requesting}>
              {requesting ? <ActivityIndicator color="#000" /> : <Text style={styles.requestText}>PEDIR CORRIDA</Text>}
            </TouchableOpacity>
          </View>
        )}

        {ride?.status === 'SEARCHING' && (
          <View style={styles.searchingBox}><ActivityIndicator color={ORANGE} /><Text style={styles.searchingText}>Procurando o motorista mais próximo...</Text></View>
        )}

        {ride?.status === 'ACCEPTED' && (
          <View style={styles.acceptedBox}>
            <Text style={styles.driverTitle}>{ride.driver?.name || ride.driverName || 'Motorista a caminho'}</Text>
            <Text style={styles.driverSub}>Motorista encontrado • R$ 17,00</Text>
          </View>
        )}

        {ride?.status === 'COMPLETED' && <TouchableOpacity style={styles.requestButton} onPress={resetRide}><Text style={styles.requestText}>NOVA CORRIDA</Text></TouchableOpacity>}
        {ride?.status === 'CANCELLED' && <TouchableOpacity style={styles.requestButton} onPress={resetRide}><Text style={styles.requestText}>PEDIR NOVAMENTE</Text></TouchableOpacity>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  map: { flex: 1 },
  loadingMap: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#aaa', marginTop: 12 },
  topBadge: { position: 'absolute', top: 50, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(9,9,9,0.94)', padding: 10, borderRadius: 15, borderWidth: 1, borderColor: '#292929' },
  badge17: { width: 44, height: 44, borderRadius: 13, backgroundColor: ORANGE, color: '#000', textAlign: 'center', textAlignVertical: 'center', fontSize: 18, fontWeight: '900', paddingTop: 11 },
  brand: { color: '#fff', fontWeight: '900', letterSpacing: 1.3, marginLeft: 10 },
  badgeSub: { color: '#8e8e8e', fontSize: 9, fontWeight: '700', marginLeft: 10, marginTop: 2 },
  bottomCard: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#101010', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, borderTopWidth: 1, borderTopColor: '#292929' },
  title: { color: '#fff', fontSize: 22, fontWeight: '900' },
  message: { color: '#a0a0a0', marginTop: 7, marginBottom: 15, fontSize: 13 },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priceLabel: { color: ORANGE, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  price: { color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 3 },
  requestButton: { backgroundColor: ORANGE, minHeight: 48, paddingHorizontal: 18, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  requestText: { color: '#000', fontWeight: '900', letterSpacing: .6 },
  disabled: { opacity: .6 },
  searchingBox: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  searchingText: { color: '#ddd', marginLeft: 12, fontWeight: '700', flex: 1 },
  acceptedBox: { backgroundColor: '#191919', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#2a2a2a' },
  driverTitle: { color: '#fff', fontSize: 17, fontWeight: '900' },
  driverSub: { color: '#aaa', marginTop: 4 }
});
