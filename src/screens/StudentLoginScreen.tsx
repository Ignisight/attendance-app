import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Crypto from 'expo-crypto';
import { DEFAULT_SERVER_URL } from '../config';

export default function StudentLoginScreen({ navigation }: any) {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        checkExistingStudent();
    }, []);

    const checkExistingStudent = async () => {
        try {
            const savedStudent = await AsyncStorage.getItem('student_user');
            if (savedStudent) {
                navigation.replace('StudentScanner');
            }
        } catch (e) { }
        finally { setChecking(false); }
    };

    const handleLogin = async () => {
        if (!email.trim() || !email.includes('@')) {
            Alert.alert('Invalid Email', 'Please enter a valid college email.');
            return;
        }

        setLoading(true);
        try {
            // Generate a secure hardware ID binding
            const hardwareId = Platform.OS + '-' + (Device.osInternalBuildId || Device.osBuildId);
            const deviceId = await Crypto.digestStringAsync(
                Crypto.CryptoDigestAlgorithm.SHA256,
                hardwareId
            );

            const response = await fetch(`${DEFAULT_SERVER_URL}/api/student/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.toLowerCase().trim(), deviceId })
            });

            const data = await response.json();
            if (data.success) {
                // Save locally
                await AsyncStorage.setItem('student_user', JSON.stringify({ email: email.toLowerCase().trim(), deviceId }));
                navigation.replace('StudentScanner');
            } else {
                Alert.alert('Login Failed', data.error || 'Failed to register this device.');
            }
        } catch (error) {
            Alert.alert('Network Error', 'Check your connection or the server URL.');
        } finally {
            setLoading(false);
        }
    };

    if (checking) return <View style={styles.container}><ActivityIndicator color="#6366f1" size="large" /></View>;

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.content}>
                <Text style={styles.title}>Student Portal</Text>
                <Text style={styles.subtitle}>Sign in to scan attendance QR codes</Text>

                <View style={styles.infoBox}>
                    <Text style={styles.infoText}>⚠️ Your phone is permanently bound to the email you use. 1 User = 1 Phone strictly enforced.</Text>
                </View>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>College Email</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. jdoe@college.edu"
                        placeholderTextColor="#475569"
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                    />
                </View>

                <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={handleLogin}
                    disabled={loading}
                >
                    {loading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Register Device & Sign In</Text>}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 24 }}>
                    <Text style={{ color: '#94a3b8', textAlign: 'center', fontWeight: '600' }}>← Go Back</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center' },
    content: { padding: 24 },
    title: { fontSize: 32, fontWeight: 'bold', color: '#f8fafc', marginBottom: 8, textAlign: 'center' },
    subtitle: { fontSize: 16, color: '#94a3b8', textAlign: 'center', marginBottom: 32 },
    infoBox: { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: '#ef4444', borderWidth: 1, padding: 16, borderRadius: 12, marginBottom: 24 },
    infoText: { color: '#f87171', fontSize: 13, fontWeight: '600', textAlign: 'center' },
    inputContainer: { marginBottom: 24 },
    label: { color: '#94a3b8', fontSize: 14, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase' },
    input: { backgroundColor: '#1e293b', borderWidth: 2, borderColor: '#334155', borderRadius: 12, padding: 16, color: '#f1f5f9', fontSize: 16 },
    button: { backgroundColor: '#6366f1', padding: 16, borderRadius: 12, alignItems: 'center', shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
    buttonDisabled: { opacity: 0.7 },
    buttonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});
