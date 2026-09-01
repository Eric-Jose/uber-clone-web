import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView } from 'react-native';

const LoginMobile = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      alert('Preencha todos os campos!');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      navigation.navigate('Main');
    }, 1000);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>🚖</Text>
        <Text style={styles.title}>UberClone</Text>
        <Text style={styles.subtitle}>Bem-vindo de volta!</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>📧 Email</Text>
          <TextInput
            style={styles.input}
            placeholder="seu@email.com"
            value={email}
            onChangeText={setEmail}
            editable={!loading}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>🔒 Senha</Text>
          <View style={styles.passwordInput}>
            <TextInput
              style={styles.inputField}
              placeholder="Sua senha"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              editable={!loading}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Text>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.btnLogin, loading && styles.btnDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.btnText}>
            {loading ? '⏳ Entrando...' : '🚀 Entrar'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Não tem conta?{' '}
          <Text
            style={styles.link}
            onPress={() => navigation.navigate('Register')}
          >
            Cadastre-se
          </Text>
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa'
  },
  header: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
    backgroundColor: '#667eea'
  },
  logo: {
    fontSize: 48,
    marginBottom: 12
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)'
  },
  form: {
    paddingHorizontal: 20,
    paddingVertical: 30
  },
  inputGroup: {
    marginBottom: 20
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textTransform: 'uppercase'
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#eee',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14
  },
  passwordInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#eee',
    borderRadius: 8,
    paddingHorizontal: 14
  },
  inputField: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14
  },
  btnLogin: {
    backgroundColor: '#667eea',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10
  },
  btnDisabled: {
    opacity: 0.6
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 20
  },
  footerText: {
    fontSize: 14,
    color: '#666'
  },
  link: {
    color: '#667eea',
    fontWeight: '600'
  }
});

export default LoginMobile;
