// src/screens/LoginScreen.tsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { C } from '../types';

type Props = { navigation: NativeStackNavigationProp<any> };

export default function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);

  const submit = async () => {
    setError('');
    setLoading(true);
    const err = await login(email.trim(), password);
    setLoading(false);
    if (err) setError(err);
  };

  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        <View style={s.logoWrap}>
          <Text style={s.logo}>NumRank</Text>
          <Text style={s.tagline}>Place numbers. Climb ranks.</Text>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Log in</Text>

          <Text style={s.label}>Email</Text>
          <TextInput
            style={s.input}
            placeholder="you@example.com"
            placeholderTextColor={C.text3}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />

          <Text style={s.label}>Password</Text>
          <View style={s.passWrap}>
            <TextInput
              style={[s.input, { marginBottom: 0, paddingRight: 60 }]}
              placeholder="••••••••"
              placeholderTextColor={C.text3}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPass}
              returnKeyType="done"
              onSubmitEditing={submit}
            />
            <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPass(v => !v)}>
              <Text style={s.eyeTxt}>{showPass ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>
          </View>

          {!!error && <Text style={s.err}>{error}</Text>}

          <TouchableOpacity
            style={[s.btn, loading && s.btnOff]}
            onPress={submit}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={C.goldD} />
              : <Text style={s.btnTxt}>Log in</Text>
            }
          </TouchableOpacity>
        </View>

        <View style={s.sepRow}>
          <View style={s.line} />
          <Text style={s.sepTxt}>or</Text>
          <View style={s.line} />
        </View>

        <TouchableOpacity
          style={s.ghost}
          onPress={() => navigation.navigate('Register')}
        >
          <Text style={s.ghostTxt}>Create an account</Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex:     { flex: 1, backgroundColor: C.bg },
  scroll:   { flexGrow: 1, padding: 24, justifyContent: 'center' },
  logoWrap: { alignItems: 'center', marginBottom: 32 },
  logo:     { fontSize: 40, fontWeight: '700', color: C.goldD, letterSpacing: -1 },
  tagline:  { fontSize: 13, color: C.text3, marginTop: 5 },
  card:     { borderRadius: 16, borderWidth: 0.5, borderColor: C.border, padding: 20, marginBottom: 16 },
  cardTitle:{ fontSize: 18, fontWeight: '600', color: C.text, marginBottom: 20 },
  label:    { fontSize: 12, color: C.text2, marginBottom: 6 },
  input:    {
    borderWidth: 0.5, borderColor: C.border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 11,
    fontSize: 14, color: C.text, marginBottom: 14,
  },
  passWrap: { position: 'relative', marginBottom: 14 },
  eyeBtn:   { position: 'absolute', right: 12, top: 11 },
  eyeTxt:   { fontSize: 12, color: C.info },
  err:      { fontSize: 12, color: C.redD, marginBottom: 12 },
  btn:      {
    backgroundColor: C.goldBg, borderWidth: 0.5, borderColor: C.gold,
    borderRadius: 8, paddingVertical: 13, alignItems: 'center', marginTop: 4,
  },
  btnTxt:   { fontSize: 14, fontWeight: '600', color: C.goldD },
  btnOff:   { opacity: 0.6 },
  sepRow:   { flexDirection: 'row', alignItems: 'center', marginVertical: 14 },
  line:     { flex: 1, height: 0.5, backgroundColor: C.border },
  sepTxt:   { fontSize: 12, color: C.text3, marginHorizontal: 12 },
  ghost:    { borderWidth: 0.5, borderColor: C.border, borderRadius: 8, paddingVertical: 13, alignItems: 'center' },
  ghostTxt: { fontSize: 14, color: C.text2 },
});
