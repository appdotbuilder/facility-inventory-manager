import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/utils/trpc';
import type { User, DashboardSummary } from '../../server/src/schema';

// Import feature components
import { LoginForm } from '@/components/LoginForm';
import { Dashboard } from '@/components/Dashboard';
import { AssetManagement } from '@/components/AssetManagement';
import { CategoryManagement } from '@/components/CategoryManagement';
import { LendingManagement } from '@/components/LendingManagement';
import { ReportsSection } from '@/components/ReportsSection';

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  const handleLogin = async (username: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await trpc.login.mutate({ username, password });
      setCurrentUser(response.user);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab('dashboard');
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="flex min-h-screen items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="space-y-1 text-center">
              <CardTitle className="text-2xl font-bold">🏢 Facility Manager</CardTitle>
              <CardDescription>
                Facilities & Infrastructure Inventory Management System
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LoginForm onLogin={handleLogin} isLoading={isLoading} />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">🏢 Facility Manager</h1>
              <Badge variant="secondary" className="hidden sm:inline-flex">
                v2.0
              </Badge>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="font-medium text-gray-900">{currentUser.username}</p>
                <p className="text-sm text-gray-600 capitalize">{currentUser.role}</p>
              </div>
              <Button onClick={handleLogout} variant="outline" size="sm">
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 h-auto">
            <TabsTrigger value="dashboard" className="flex flex-col gap-1 py-3">
              <span>📊</span>
              <span className="text-xs">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="assets" className="flex flex-col gap-1 py-3">
              <span>📦</span>
              <span className="text-xs">Assets</span>
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex flex-col gap-1 py-3">
              <span>📂</span>
              <span className="text-xs">Categories</span>
            </TabsTrigger>
            <TabsTrigger value="lending" className="flex flex-col gap-1 py-3">
              <span>🤝</span>
              <span className="text-xs">Lending</span>
            </TabsTrigger>
            <TabsTrigger value="returns" className="flex flex-col gap-1 py-3">
              <span>📥</span>
              <span className="text-xs">Returns</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex flex-col gap-1 py-3">
              <span>📈</span>
              <span className="text-xs">Reports</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <Dashboard />
          </TabsContent>

          <TabsContent value="assets">
            <AssetManagement />
          </TabsContent>

          <TabsContent value="categories">
            <CategoryManagement />
          </TabsContent>

          <TabsContent value="lending">
            <LendingManagement mode="lending" />
          </TabsContent>

          <TabsContent value="returns">
            <LendingManagement mode="returns" />
          </TabsContent>

          <TabsContent value="reports">
            <ReportsSection />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

export default App;