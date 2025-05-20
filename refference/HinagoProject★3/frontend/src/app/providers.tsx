import React from 'react';
import { AuthProvider } from '@common/hooks/useAuth';

/**
 * アプリケーション全体のプロバイダーを統合するコンポーネント
 */
const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
};

export default AppProviders;