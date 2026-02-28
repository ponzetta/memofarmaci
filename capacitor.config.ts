import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'it.memofarmaci.app',
  appName: 'MemoFarmaci',
  webDir: 'dist',
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    StatusBar: {
      overlaysWebView: true,
      style: 'LIGHT',
      backgroundColor: '#00000000',
    },
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '815488260722-nu7nsn9m8tlrpk9pqb97j3ra7cslkhsv.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;
