export interface UserData {
  id: string;
  email: string;
  name: string;
  message: string;
  timestamp: string;
  browser: string;
  os: string;
  screenSize: 'Desktop' | 'Mobile' | 'Tablet';
  images: { id: string; url: string }[];
}

export const generateUsers = (count: number): UserData[] => {
  // ... generateUsers function implementation ...
};

