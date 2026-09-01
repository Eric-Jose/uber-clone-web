import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Alert } from 'react-native';

const ProfileMobile = ({ navigation }) => {
  const [user, setUser] = useState({
    name: 'João Silva',
    email: 'joao@email.com',
    phone: '(11) 99999-9999',
    rating: 4.8,
    totalRides: 247,
    profileImage: '👤'
  });

  const [stats] = useState([
    { icon: '🚗', label: 'Corridas', value: '247' },
    { icon: '⭐', label: 'Avaliação', value: '4.8' },
    { icon: '💰', label: 'Economizado', value: 'R$ 145' },
    { icon: '🎁', label: 'Cupons', value: '5' }
  ]);

  const handleLogout = () => {
    Alert.alert('Sair', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', onPress: () => navigation.navigate('Login') }
    ]);
  };

  const menuItems = [
    { icon: '⚙️', label: 'Configurações', onPress: () => Alert.alert('Configurações') },
    { icon: '💳', label: 'Métodos de Pagamento', onPress: () => Alert.alert('Pagamento') },
    { icon: '📜', label: 'Histórico de Corridas', onPress: () => Alert.alert('Histórico') },
    { icon: '⭐', label: 'Avaliações', onPress: () => Alert.alert('Avaliações') },
    { icon: '❓', label: 'Ajuda', onPress: () => Alert.alert('Ajuda') },
    { icon: '🚪', label: 'Sair', onPress: handleLogout }
  ];

  return (
    <ScrollView style={styles.container}>
      {/* Header do Perfil */}
      <View style={styles.profileHeader}>
        <Text style={styles.profileImage}>{user.profileImage}</Text>
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.email}>{user.email}</Text>
        <Text style={styles.phone}>{user.phone}</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsGrid}>
        {stats.map((stat, index) => (
          <View key={index} style={styles.statCard}>
            <Text style={styles.statIcon}>{stat.icon}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
            <Text style={styles.statValue}>{stat.value}</Text>
          </View>
        ))}
      </View>

      {/* Menu */}
      <View style={styles.menu}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.menuItem}
            onPress={item.onPress}
          >
            <Text style={styles.menuIcon}>{item.icon}</Text>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa'
  },
  profileHeader: {
    backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20
  },
  profileImage: {
    fontSize: 48,
    marginBottom: 12
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4
  },
  email: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2
  },
  phone: {
    fontSize: 14,
    color: '#999'
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
    paddingVertical: 20
  },
  statCard: {
    width: '50%',
    alignItems: 'center',
    paddingVertical: 15,
    backgroundColor: '#fff',
    marginHorizontal: '2.5%',
    marginVertical: 5,
    borderRadius: 10,
    elevation: 2
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 8
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333'
  },
  menu: {
    marginTop: 20,
    marginHorizontal: 10,
    marginBottom: 20
  },
  menuItem: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 15,
    marginBottom: 8,
    borderRadius: 10,
    elevation: 1
  },
  menuIcon: {
    fontSize: 20,
    marginRight: 12
  },
  menuLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#333'
  },
  menuArrow: {
    fontSize: 18,
    color: '#999'
  }
});

export default ProfileMobile;
