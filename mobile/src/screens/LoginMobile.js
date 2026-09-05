import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { login } from '../services/mobileApi';

const ORANGE = '#ff6a00';
const BG = '#090909';
const CARD = '#151515';

const LoginMobile = ({ navigation, onLoggedIn }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Dados incompletos', 'Informe seu email e sua senha.');
      return;
    }
    try {
      setLoading(true);
      const data = await login(email, password);
      onLoggedIn({ token: data.token, user: data.user });
    } catch (error) {
      Alert.alert('Não foi possível entrar', error.message || 'Email ou senha inválidos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <View style={styles.logoBox}><Text style={styles.logo17}>17</Text></View>
          <Text style={styles.brandTitle}>PREÇOFIXO</Text>
          <Text style={styles.brandSub}>Sua corrida. Seu preço. R$ 17.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>Entrar</Text>
          <Text style={styles.description}>Acesse sua conta para pedir uma corrida.</Text>

          <Text style={styles.label}>EMAIL</Text>
          <TextInput
            style={styles.input}
            placeholder="seu@email.com"
            placeholderTextColor="#707070"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
            editable={!loading}
          />

          <Text style={styles.label}>SENHA</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={styles.password}
              placeholder="Sua senha"
              placeholderTextColor="#707070"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              editable={!loading}
              onSubmitEditing={handleLogin}
            />
            <TouchableOpacity style={styles.eye} onPress={() => setShowPassword((value) => !value)} disabled={loading}>
              <Text style={styles.eyeText}>{showPassword ? 'OCULTAR' : 'VER'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={[styles.button, loading && styles.disabled]} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.buttonText}>ENTRAR</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Register')} disabled={loading} style={styles.registerButton}>
            <Text style={styles.registerText}>Ainda não tenho conta <Text style={styles.registerStrong}>CADASTRAR</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  content: { flexGrow: 1, justifyContent: 'center', padding: 22 },
  brand: { alignItems: 'center', marginBottom: 28 },
  logoBox: { width: 72, height: 72, borderRadius: 20, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  logo17: { color: '#000', fontSize: 30, fontWeight: '900' },
  brandTitle: { color: '#fff', fontSize: 26, fontWeight: '900', letterSpacing: 2 },
  brandSub: { color: '#9b9b9b', fontSize: 12, marginTop: 6 },
  card: { backgroundColor: CARD, borderRadius: 22, padding: 22, borderWidth: 1, borderColor: '#242424' },
  heading: { color: '#fff', fontSize: 28, fontWeight: '800' },
  description: { color: '#9b9b9b', marginTop: 6, marginBottom: 24 },
  label: { color: '#bcbcbc', fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
  input: { backgroundColor: '#0d0d0d', borderRadius: 12, borderWidth: 1, borderColor: '#292929', color: '#fff', paddingHorizontal: 14, paddingVertical: 14, marginBottom: 18 },
  passwordRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0d0d0d', borderRadius: 12, borderWidth: 1, borderColor: '#292929', marginBottom: 22 },
  password: { flex: 1, color: '#fff', paddingHorizontal: 14, paddingVertical: 14 },
  eye: { paddingHorizontal: 12 },
  eyeText: { color: ORANGE, fontSize: 10, fontWeight: '900' },
  button: { backgroundColor: ORANGE, minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#000', fontWeight: '900', letterSpacing: 1 },
  disabled: { opacity: 0.65 },
  registerButton: { alignItems: 'center', paddingTop: 20 },
  registerText: { color: '#929292', fontSize: 13 },
  registerStrong: { color: ORANGE, fontWeight: '900' }
});

export default LoginMobile;
