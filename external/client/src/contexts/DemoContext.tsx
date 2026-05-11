import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface DemoContextType {
  isDemo: boolean;
  demoSocialAccounts: DemoSocialAccount[];
}

interface DemoSocialAccount {
  id: string;
  platform: string;
  accountUsername: string;
  isConnected: boolean;
  profileImage?: string;
}

const DemoContext = createContext<DemoContextType | undefined>(undefined);

const DEMO_SOCIAL_ACCOUNTS: DemoSocialAccount[] = [
  {
    id: 'demo-facebook',
    platform: 'facebook',
    accountUsername: 'Nebraska Home Hub',
    isConnected: true,
    profileImage: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=100&h=100&fit=crop'
  },
  {
    id: 'demo-instagram',
    platform: 'instagram',
    accountUsername: '@nebraskahomehub',
    isConnected: true,
    profileImage: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=100&h=100&fit=crop'
  },
  {
    id: 'demo-linkedin',
    platform: 'linkedin',
    accountUsername: 'Nebraska Home Hub Real Estate',
    isConnected: true,
    profileImage: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=100&h=100&fit=crop'
  },
  {
    id: 'demo-x',
    platform: 'x',
    accountUsername: '@NebraskaHomeHub',
    isConnected: true,
    profileImage: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=100&h=100&fit=crop'
  },
  {
    id: 'demo-youtube',
    platform: 'youtube',
    accountUsername: 'Nebraska Home Hub Channel',
    isConnected: true,
    profileImage: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=100&h=100&fit=crop'
  },
  {
    id: 'demo-tiktok',
    platform: 'tiktok',
    accountUsername: '@nebraskahomehub',
    isConnected: true,
    profileImage: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=100&h=100&fit=crop'
  }
];

export function DemoProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    if (user && (user as any).isDemo) {
      setIsDemo(true);
    } else {
      setIsDemo(false);
    }
  }, [user]);

  return (
    <DemoContext.Provider value={{ isDemo, demoSocialAccounts: DEMO_SOCIAL_ACCOUNTS }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (context === undefined) {
    throw new Error('useDemo must be used within a DemoProvider');
  }
  return context;
}
