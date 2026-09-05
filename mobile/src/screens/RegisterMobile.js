import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { register } from '../services/mobileApi';

const ORANGE = '#ff6a00';
const BG = '#090909';
const CARD = '#151515';

export default function RegisterMobile({ navigation, onRegistered }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password || !confirm) {
      Alert.alert('Dados incompletos', 'Preencha nome, email e senha.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Senha inválida', 'A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Senhas diferentes', 'Confirme a senha corretamente.');
      return;
    }
    try {
      setLoading(true);
      const data = await register({ name: name.trim(), phone: phone.trim(), email, password, userType: 'passenger' });
      onRegistered({ token: data.token, user: data.user });
    } catch (error) {
      Alert.alert('Não foi possível cadastrar', error.message || 'Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}><Text style={styles.backText}>‹ VOLTAR</Text></TouchableOpacity>
        <View style={styles.brand}><View style={styles.logo}><Text style={styles.logoText}>17</Text></View><Text style={styles.title}>CRIAR CONTA</Text></View>
        <View style={styles.card}>
          {[
            ['NOME', name, setName, 'Seu nome', 'default'],
            ['TELEFONE', phone, setPhone, '(11) 99999-9999', 'phone-pad'],
            ['EMAIL', email, setEmail, 'seu@email.com', 'email-address']
          ].map(([label, value, setter, placeholder, keyboardType]) => (
            <View key={label}>
              <Text style={styles.label}>{label}</Text>
              <TextInput style={styles.input} value={value} onChangeText={setter} placeholder={placeholder} placeholderTextColor="#666" keyboardType={keyboardType} autoCapitalize={keyboardType === 'email-address' ? 'none' : 'words'} editable={!loading} />
            </View>
          ))}
          <Text style={styles.label}>SENHA</Text>
          <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Mínimo 6 caracteres" placeholderTextColor="#666" secureTextEntry editable={!loading} />
          <Text style={styles.label}>CONFIRMAR SENHA</Text>
          <TextInput style={styles.input} value={confirm} onChangeText={setConfirm} placeholder="Repita a senha" placeholderTextColor="#666" secureTextEntry editable={!loading} />
          <TouchableOpacity style={[styles.button, loading && styles.disabled]} onPress={handleRegister} disabled={loading}>
            {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.buttonText}>CRIAR CONTA</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  content: { padding: 22, paddingTop: 48, paddingBottom: 40 },
  back: { paddingVertical: 8, marginBottom: 20 },
  backText: { color: ORANGE, fontWeight: '900', letterSpacing: 0.8 },
  brand: { alignItems: 'center', marginBottom: 24 },
  logo: { width: 60, height: 60, borderRadius: 18, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  logoText: { color: '#000', fontSize: 24, fontWeight: '900' },
  title: { color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: 1.3 },
  card: { backgroundColor: CARD, borderRadius: 22, padding: 20, borderWidth: 1, borderColor: '#242424' },
  label: { color: '#aaa', fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 7, marginTop: 4 },
  input: { backgroundColor: '#0d0d0d', borderRadius: 12, borderWidth: 1, borderColor: '#2a2a2a', color: '#fff', paddingHorizontal: 14, paddingVertical: 14, marginBottom: 15 },
  button: { backgroundColor: ORANGE, minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  buttonText: { color: '#000', fontWeight: '900', letterSpacing: 1 },
  disabled: { opacity: 0.65 }
});
