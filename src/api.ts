import { DEFAULT_SERVER_URL } from './config';
import AsyncStorage from '@react-native-async-storage/async-storage';

let SERVER_URL = DEFAULT_SERVER_URL;

export function setServerUrl(url: string) {
    SERVER_URL = url.replace(/\/+$/, '');
}

export function getServerUrl() {
    return SERVER_URL;
}

// ==========================================
// AUTH
// ==========================================

export async function register(name: string, email: string, password: string, college?: string, department?: string) {
    const res = await fetch(`${SERVER_URL}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, college, department }),
    });
    return await res.json();
}

export async function login(email: string, password: string) {
    const res = await fetch(`${SERVER_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    return await res.json();
}

export async function forgotPassword(email: string) {
    const res = await fetch(`${SERVER_URL}/api/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
    });
    return await res.json();
}

export async function resetPassword(email: string, otp: string, newPassword: string) {
    const res = await fetch(`${SERVER_URL}/api/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword }),
    });
    return await res.json();
}

// ==========================================
// ATTENDANCE
// ==========================================

export async function startSession(sessionName: string) {
    const res = await fetch(`${SERVER_URL}/api/start-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionName }),
    });
    return await res.json();
}

export async function stopSession() {
    const res = await fetch(`${SERVER_URL}/api/stop-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });
    return await res.json();
}

export async function getResponses(sessionName?: string) {
    let url = `${SERVER_URL}/api/responses`;
    if (sessionName) {
        url += `?sessionName=${encodeURIComponent(sessionName)}`;
    }
    const res = await fetch(url);
    return await res.json();
}

export async function pingServer(url: string): Promise<boolean> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(`${url.replace(/\/+$/, '')}/api/status`, {
            signal: controller.signal,
        });
        clearTimeout(timeout);
        return res.ok;
    } catch {
        return false;
    }
}

// ==========================================
// PERSISTENCE
// ==========================================

const USER_KEY = 'attendance_user_data';

export async function saveUser(user: any) {
    try {
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (e) {
        console.error('Failed to save user', e);
    }
}

export async function getUser() {
    try {
        const json = await AsyncStorage.getItem(USER_KEY);
        return json != null ? JSON.parse(json) : null;
    } catch (e) {
        console.error('Failed to load user', e);
        return null;
    }
}

export async function clearUser() {
    try {
        await AsyncStorage.removeItem(USER_KEY);
    } catch (e) {
        console.error('Failed to clear user', e);
    }
}
