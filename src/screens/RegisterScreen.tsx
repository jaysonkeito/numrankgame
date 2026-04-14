// src/screens/RegisterScreen.tsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { C, validateUsername } from '../types';

type Props = { navigation: NativeStackNavigationProp<any> };

const MAX = 16, MIN = 6;

export default function RegisterScreen({ navigation }: Props) {
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [success,  setSuccess]  = useState(false);

  const uErr = username.length > 0 ? validateUsername(username) : null;
  const pStr = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3;
  const pCol = (['', C.red, C.gold, C.green] as string[])[pStr];
  const pLbl = (['', 'Weak', 'Fair', 'Strong'] as string[])[pStr];

  const charColor = () => {
    if (!username.length)          return C.text3;
    if (username.length < MIN)     return C.red;
    if (username.length > MAX - 3) return C.gold;
    return C.green;
  };

  const submit = async () => {
    setError('');
    setLoading(true);
    const err = await register(username.trim(), email.trim(), password);
    setLoading(false);
    if (err) { setError(err); return; }
    setSuccess(true);
  };

  // ── Success screen ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <View style={s.successScreen}>
        <View style={s.successIcon}>
          <Text style={{ fontSize: 36, color: C.green }}>✓</Text>
        </View>
        <Text style={s.successTitle}>Account created!</Text>
        <Text style={s.successSub}>
          Registration successful. Please log in to start playing.
        </Text>
        <View style={s.successBox}>
          <Text style={s.successBoxLbl}>Your 9-digit Player ID has been generated</Text>
          <Text style={s.successBoxHint}>You can find it in your Profile after logging in.</Text>
        </View>
        <TouchableOpacity style={s.btn} onPress={() => navigation.navigate('Login')}>
          <Text style={s.btnTxt}>Go to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Register form ───────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        <View style={s.logoWrap}>
          <Text style={s.logo}>NumRank</Text>
          <Text style={s.tagline}>Create your account</Text>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Register</Text>

          {/* Username */}
          <Text style={s.label}>
            Username{' '}
            <Text style={{ color: C.text3, fontWeight: '400' }}>
              (6–16 chars · letters, numbers, underscore)
            </Text>
          </Text>
          <TextInput
            style={[s.input, !!uErr && { borderColor: C.red }]}
            placeholder="e.g. JuanDC_99"
            placeholderTextColor={C.text3}
            value={username}
            onChangeText={setUsername}
            maxLength={MAX}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={s.charRow}>
            <Text style={[s.fieldErr, { opacity: uErr ? 1 : 0 }]}>{uErr ?? ' '}</Text>
            <Text style={[s.charCount, { color: charColor() }]}>{username.length}/{MAX}</Text>
          </View>

          {/* Email */}
          <Text style={s.label}>Email</Text>
          <TextInput
            style={s.input}
            placeholder="you@example.com"
            placeholderTextColor={C.text3}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {/* Password */}
          <Text style={s.label}>
            Password{' '}
            <Text style={{ color: C.text3, fontWeight: '400' }}>(min 8 characters)</Text>
          </Text>
          <View style={s.passWrap}>
            <TextInput
              style={[s.input, { marginBottom: 0, paddingRight: 60 }]}
              placeholder="Minimum 8 characters"
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

          {password.length > 0 && (
            <View style={s.strRow}>
              {[1, 2, 3].map(i => (
                <View
                  key={i}
                  style={[s.strBar, { backgroundColor: pStr >= i ? pCol : C.border }]}
                />
              ))}
              <Text style={[s.strLbl, { color: pCol }]}>{pLbl}</Text>
            </View>
          )}

          {!!error && <Text style={s.err}>{error}</Text>}

          <View style={s.notice}>
            <Text style={s.noticeTxt}>
              A unique{' '}
              <Text style={{ fontWeight: '600' }}>9-digit Player ID</Text>
              {' '}will be auto-generated after registration.
            </Text>
          </View>

          <TouchableOpacity
            style={[s.btn, loading && s.btnOff]}
            onPress={submit}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={C.goldD} />
              : <Text style={s.btnTxt}>Create account</Text>
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
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={s.ghostTxt}>Already have an account? Log in</Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex:    { flex: 1, backgroundColor: C.bg },
  scroll:  { flexGrow: 1, padding: 24, justifyContent: 'center' },
  logoWrap:{ alignItems: 'center', marginBottom: 28 },
  logo:    { fontSize: 40, fontWeight: '700', color: C.goldD, letterSpacing: -1 },
  tagline: { fontSize: 13, color: C.text3, marginTop: 5 },
  card:    { borderRadius: 16, borderWidth: 0.5, borderColor: C.border, padding: 20, marginBottom: 16 },
  cardTitle:{ fontSize: 18, fontWeight: '600', color: C.text, marginBottom: 20 },
  label:   { fontSize: 12, color: C.text2, marginBottom: 6 },
  input:   {
    borderWidth: 0.5, borderColor: C.border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 11,
    fontSize: 14, color: C.text, marginBottom: 4,
  },
  charRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  fieldErr: { fontSize: 11, color: C.red, flex: 1 },
  charCount:{ fontSize: 11, fontWeight: '500' },
  passWrap: { position: 'relative', marginBottom: 8 },
  eyeBtn:   { position: 'absolute', right: 12, top: 11 },
  eyeTxt:   { fontSize: 12, color: C.info },
  strRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  strBar:   { flex: 1, height: 4, borderRadius: 2 },
  strLbl:   { fontSize: 11, minWidth: 36 },
  err:      { fontSize: 12, color: C.redD, marginBottom: 12 },
  notice:   { backgroundColor: C.goldBg, borderRadius: 8, padding: 12, marginBottom: 14 },
  noticeTxt:{ fontSize: 12, color: C.goldD, lineHeight: 18 },
  btn:      {
    backgroundColor: C.goldBg, borderWidth: 0.5, borderColor: C.gold,
    borderRadius: 8, paddingVertical: 13, alignItems: 'center',
  },
  btnTxt:   { fontSize: 14, fontWeight: '600', color: C.goldD },
  btnOff:   { opacity: 0.6 },
  sepRow:   { flexDirection: 'row', alignItems: 'center', marginVertical: 14 },
  line:     { flex: 1, height: 0.5, backgroundColor: C.border },
  sepTxt:   { fontSize: 12, color: C.text3, marginHorizontal: 12 },
  ghost:    { borderWidth: 0.5, borderColor: C.border, borderRadius: 8, paddingVertical: 13, alignItems: 'center' },
  ghostTxt: { fontSize: 14, color: C.text2 },

  // Success
  successScreen: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 32 },
  successIcon:   { width: 72, height: 72, borderRadius: 36, backgroundColor: C.greenBg, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  successTitle:  { fontSize: 24, fontWeight: '700', color: C.text, marginBottom: 10 },
  successSub:    { fontSize: 14, color: C.text2, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  successBox:    { backgroundColor: C.goldBg, borderRadius: 12, padding: 16, width: '100%', marginBottom: 28 },
  successBoxLbl: { fontSize: 13, fontWeight: '600', color: C.goldD, textAlign: 'center' },
  successBoxHint:{ fontSize: 12, color: C.goldD, textAlign: 'center', marginTop: 4 },
});
