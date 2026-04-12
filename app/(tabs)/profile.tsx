import { useAuth } from '@/store/auth';
import { LinearGradient } from 'expo-linear-gradient';
import { LogOut, MapPin, User as UserIcon } from 'lucide-react-native';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0f172a', '#1e293b']} style={StyleSheet.absoluteFillObject} />
      
      <View style={styles.header}>
        <View style={styles.avatarWrapper}>
            <Image 
            source={{ uri: user?.avatarUrl || 'https://i.ibb.co/68vS1zZ/default-avatar.png' }} 
            style={styles.avatar} 
            />
        </View>
        <Text style={styles.name}>{user?.fullName}</Text>
        <View style={styles.roleBadge}>
            <Text style={styles.role}>{user?.role?.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.infoCard}>
          <View style={styles.infoIconBox}>
             <MapPin size={20} color="#10b981" />
          </View>
          <View>
              <Text style={styles.infoLabel}>REGION</Text>
              <Text style={styles.infoValue}>{user?.region || 'N/A'}</Text>
          </View>
        </View>
        
        <View style={styles.infoCard}>
          <View style={[styles.infoIconBox, { borderColor: 'rgba(139, 92, 246, 0.3)', backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
             <UserIcon size={20} color="#8b5cf6" />
          </View>
          <View>
              <Text style={styles.infoLabel}>GENDER</Text>
              <Text style={styles.infoValue}>{user?.gender || 'N/A'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout} activeOpacity={0.8}>
          <LogOut size={24} color="#ef4444" />
          <Text style={styles.logoutText}>LOG OUT</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { alignItems: 'center', paddingTop: 60, paddingBottom: 40 },
  
  avatarWrapper: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: '#1e293b',
      padding: 4,
      borderWidth: 4,
      borderColor: '#3b82f6',
      borderBottomWidth: 8,
      marginBottom: 20
  },
  avatar: { 
      width: '100%', 
      height: '100%', 
      borderRadius: 60,
      backgroundColor: '#334155'
  },
  name: { fontSize: 28, fontWeight: '800', color: '#f8fafc', marginBottom: 8 },
  
  roleBadge: {
      backgroundColor: 'rgba(59, 130, 246, 0.15)',
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: 'rgba(59, 130, 246, 0.3)'
  },
  role: { fontSize: 14, color: '#3b82f6', fontWeight: '800', letterSpacing: 1.5 },
  
  content: { padding: 24, gap: 16 },
  
  infoCard: { 
      backgroundColor: '#1e293b', 
      padding: 20, 
      borderRadius: 20, 
      borderWidth: 2, 
      borderColor: '#334155', 
      borderBottomWidth: 5,
      flexDirection: 'row', 
      alignItems: 'center',
      gap: 16
  },
  infoIconBox: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      borderWidth: 2,
      borderColor: 'rgba(16, 185, 129, 0.3)',
      justifyContent: 'center',
      alignItems: 'center'
  },
  infoLabel: { color: '#94a3b8', fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  infoValue: { color: '#f8fafc', fontSize: 18, fontWeight: '700' },
  
  footer: { padding: 24, marginTop: 'auto', paddingBottom: 100 },
  
  logoutBtn: { 
      backgroundColor: 'rgba(239, 68, 68, 0.1)', 
      padding: 20, 
      borderRadius: 16, 
      flexDirection: 'row', 
      justifyContent: 'center', 
      alignItems: 'center', 
      gap: 12, 
      borderWidth: 2, 
      borderColor: 'rgba(239, 68, 68, 0.3)',
      borderBottomWidth: 5
  },
  logoutText: { color: '#ef4444', fontSize: 18, fontWeight: '800', letterSpacing: 1 }
});
