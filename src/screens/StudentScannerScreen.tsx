import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { Camera, CameraView } from 'expo-camera';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_SERVER_URL } from '../config';

export default function StudentScannerScreen({ navigation }: any) {
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [scanned, setScanned] = useState(false);
    const [studentInfo, setStudentInfo] = useState<{ email: string, deviceId: string } | null>(null);
    const [message, setMessage] = useState('Aim camera at the Teacher\'s QR Code');

    useEffect(() => {
        (async () => {
            const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
            const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
            setHasPermission(cameraStatus === 'granted' && locationStatus === 'granted');

            const savedString = await AsyncStorage.getItem('student_user');
            if (savedString) {
                setStudentInfo(JSON.parse(savedString));
            } else {
                navigation.replace('StudentLogin');
            }
        })();
    }, []);

    const handleBarcodeScanned = async ({ type, data }: { type: string, data: string }) => {
        if (scanned || !studentInfo) return;
        setScanned(true);

        try {
            // Validate it's an attendance QR code
            // Format is usually: https://attendance-server.../s/{sessionCode}
            const match = data.match(/\/s\/([a-zA-Z0-9_-]+)/);
            if (!match) {
                setMessage('Invalid QR code scanned. Try again.');
                setTimeout(() => setScanned(false), 3000);
                return;
            }

            const sessionCode = match[1];
            setMessage('📍 Getting Location...');

            // Geolocation Fetch
            let location;
            try {
                location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
            } catch (err) {
                setMessage('Failed to get Location. Retrying...');
                location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            }

            setMessage('⏳ Submitting Attendance...');

            // Submit to specific React Native mobile API
            const res = await fetch(`${DEFAULT_SERVER_URL}/api/student/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: studentInfo.email,
                    deviceId: studentInfo.deviceId,
                    sessionCode: sessionCode,
                    lat: location.coords.latitude,
                    lon: location.coords.longitude
                })
            });

            const responseText = await res.text();
            let resultData;
            try { resultData = JSON.parse(responseText); } catch (e) { throw new Error('Crashed: ' + responseText); }


            if (resultData.success) {
                Alert.alert('✅ Attendance Recorded!', 'You are marked present for this session.', [
                    { text: 'OK', onPress: () => setScanned(false) }
                ]);
                setMessage('Success! Ready to scan again.');
            } else {
                Alert.alert('Attendance Failed', resultData.error || 'Unknown error occurred.', [
                    { text: 'Try Again', onPress: () => setScanned(false) }
                ]);
                setMessage('Failed. Try scanning again.');
            }

        } catch (error: any) {
            Alert.alert('Network Error', error.message || 'Failed to submit attendance.');
            setScanned(false);
            setMessage('Network error. Try scanning again.');
        }
    };

    if (hasPermission === null) {
        return <View style={styles.container}><Text style={styles.text}>Requesting permissions...</Text></View>;
    }
    if (hasPermission === false) {
        return <View style={styles.container}><Text style={styles.text}>No access to camera or location. Please allow in settings.</Text></View>;
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.navigate('RoleSelection')} style={styles.logoutBtn}>
                    <Text style={styles.logoutText}>Switch Role</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Scan Session QR</Text>
                <View style={{ width: 60 }} />
            </View>

            <View style={styles.cameraFrame}>
                <CameraView
                    style={StyleSheet.absoluteFillObject}
                    onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
                    barcodeScannerSettings={{
                        barcodeTypes: ["qr"],
                    }}
                >
                    <View style={styles.overlay}>
                        <View style={styles.unfocusedContainer} />
                        <View style={styles.middleContainer}>
                            <View style={styles.unfocusedContainer} />
                            <View style={styles.focusedContainer} />
                            <View style={styles.unfocusedContainer} />
                        </View>
                        <View style={styles.unfocusedContainer} />
                    </View>
                </CameraView>
            </View>

            <View style={styles.footer}>
                <Text style={styles.footerText}>{studentInfo?.email}</Text>
                <Text style={[styles.statusText, scanned && { color: '#f59e0b' }]}>{message}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    text: { color: 'white', alignSelf: 'center', marginTop: '50%' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: 'white' },
    logoutBtn: { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#1e293b', borderRadius: 8, borderWidth: 1, borderColor: '#334155' },
    logoutText: { color: '#94a3b8', fontSize: 12, fontWeight: 'bold' },
    cameraFrame: { flex: 1, overflow: 'hidden' },
    overlay: { flex: 1, backgroundColor: 'transparent' },
    unfocusedContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' },
    middleContainer: { flexDirection: 'row', flex: 1.5 },
    focusedContainer: { flex: 6, borderWidth: 2, borderColor: '#22c55e', backgroundColor: 'transparent' },
    footer: { padding: 40, backgroundColor: '#0f172a', alignItems: 'center' },
    footerText: { color: '#94a3b8', fontSize: 13, marginBottom: 8, fontWeight: '500' },
    statusText: { color: '#22c55e', fontSize: 16, fontWeight: 'bold', textAlign: 'center' }
});
