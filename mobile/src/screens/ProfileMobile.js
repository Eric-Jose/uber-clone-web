import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getUser } from '../services/mobileApi';

const ORANGE = '#ff6a00';
const BG = '#090909';
const CARD = '#151515';

export default function ProfileMobile({ route }) {
  const onLogout = route?.params?.onLogout;
  const [user, setUser] = useState(null);

  useEffect(() => {
    getUser().then(setUser);
  }, []);

  const handleLogout = () => {
    Alert.alert('Sair', 'Deseja encerrar sua sessão?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: onLogout }
    ]);
  };

  if (!user) return <View style={styles.loading}><ActivityIndicator color={ORANGE} size="large" /></View>;

  const rides = Number(user.totalRides || 0);
  const rating = Number(user.rating || 5).toFixed(1);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{String(user.name || 'P').trim().charAt(0).toUpperCase()}</Text></View>
        <Text style={styles.name}>{user.name || 'Usuário'}</Text>
        <Text style={styles.email}>{user.email || ''}</Text>
        {!!user.phone && <Text style={styles.phone}>{user.phone}</Text>}
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}><Text style={styles.statValue}>{rides}</Text><Text style={styles.statLabel}>CORRIDAS</Text></View>
        <View style={styles.divider} />
        <View style={styles.stat}><Text style={styles.statValue}>★ {rating}</Text><Text style={styles.statLabel}>AVALIAÇÃO</Text></View>
        <View style={styles.divider} />
        <View style={styles.stat}><Text style={styles.statValue}>R$ 17</Text><Text style={styles.statLabel}>TARIFA</Text></View>
      </View>

      <Text style={styles.section}>CONTA</Text>
      <View style={styles.menu}>
        <View style={styles.row}><Text style={styles.icon}>◆</Text><Text style={styles.rowText}>Métodos de pagamento</Text><Text style={styles.arrow}>›</Text></View>
        <View style={styles.row}><Text style={styles.icon}>▤</Text><Text style={styles.rowText}>Histórico de corridas</Text><Text style={styles.arrow}>›</Text></View>
        <View style={styles.row}><Text style={styles.icon}>?</Text><Text style={styles.rowText}>Ajuda e suporte</Text><Text style={styles.arrow}>›</Text></View>
      </View>

      <TouchableOpacity style={styles.logout} onPress={handleLogout}><Text style={styles.logoutText}>SAIR DA CONTA</Text></TouchableOpacity>
      <Text style={styles.version}>PreçoFixo17 • mobile 1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  content: { paddingBottom: 35 },
  loading: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', paddingTop: 55, paddingBottom: 26 },
  avatar: { width: 82, height: 82, borderRadius: 26, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', marginBottom: 13 },
  avatarText: { color: '#000', fontSize: 36, fontWeight: '900' },
  name: { color: '#fff', fontSize: 23, fontWeight: '900' },
  email: { color: '#999', marginTop: 5 },
  phone: { color: '#777', marginTop: 3 },
  stats: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, backgroundColor: CARD, borderRadius: 17, paddingVertical: 18, borderWidth: 1, borderColor: '#252525' },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { color: '#fff', fontWeight: '900', fontSize: 16 },
  statLabel: { color: '#777', fontSize: 9, fontWeight: '900', marginTop: 5, letterSpacing: .8 },
  divider: { width: 1, height: 28, backgroundColor: '#2a2a2a' },
  section: { color: '#777', fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginHorizontal: 20, marginTop: 29, marginBottom: 9 },
  menu: { backgroundColor: CARD, marginHorizontal: 16, borderRadius: 17, borderWidth: 1, borderColor: '#252525' },
  row: { minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 17, borderBottomWidth: 1, borderBottomColor: '#222' },
  icon: { color: ORANGE, width: 28, fontSize: 16, textAlign: 'center' },
  rowText: { color: '#eee', flex: 1, fontSize: 14, marginLeft: 6 },
  arrow: { color: '#777', fontSize: 24 },
  logout: { marginHorizontal: 16, marginTop: 25, borderRadius: 14, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#5a2620' },
  logoutText: { color: '#ff7c62', fontWeight: '900', letterSpacing: .8 },
  version: { color: '#555', textAlign: 'center', marginTop: 20, fontSize: 10 }
});
