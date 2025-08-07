import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/utils/trpc';
import type { DashboardSummary } from '../../../server/src/schema';

export function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await trpc.getDashboardSummary.query();
      setSummary(data);
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Dashboard error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  if (error) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={loadDashboardData} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Dashboard Overview</h2>
          <p className="text-gray-600 mt-1">Real-time inventory and lending statistics</p>
        </div>
        <Button onClick={loadDashboardData} variant="outline" size="sm" disabled={isLoading}>
          🔄 Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700">Total Assets</CardTitle>
            <span className="text-2xl">📦</span>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-blue-900">{summary?.total_assets || 0}</div>
            )}
            <p className="text-xs text-blue-600 mt-1">All registered items</p>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700">Available</CardTitle>
            <span className="text-2xl">✅</span>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-green-900">{summary?.available_assets || 0}</div>
            )}
            <p className="text-xs text-green-600 mt-1">Ready for lending</p>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-700">Currently Lent</CardTitle>
            <span className="text-2xl">🤝</span>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-orange-900">{summary?.lent_assets || 0}</div>
            )}
            <p className="text-xs text-orange-600 mt-1">Out on loan</p>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-700">Overdue</CardTitle>
            <span className="text-2xl">⚠️</span>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-red-900">{summary?.overdue_lendings || 0}</div>
            )}
            <p className="text-xs text-red-600 mt-1">Past due date</p>
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats Row */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-purple-200 bg-purple-50/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-700">In Maintenance</CardTitle>
            <span className="text-2xl">🔧</span>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-purple-900">{summary?.assets_in_maintenance || 0}</div>
            )}
            <p className="text-xs text-purple-600 mt-1">Being serviced</p>
          </CardContent>
        </Card>

        <Card className="border-indigo-200 bg-indigo-50/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-indigo-700">Categories</CardTitle>
            <span className="text-2xl">📂</span>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-indigo-900">{summary?.total_categories || 0}</div>
            )}
            <p className="text-xs text-indigo-600 mt-1">Asset categories</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Lendings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              📤 Recent Lendings
            </CardTitle>
            <CardDescription>Latest assets lent out</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i: number) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !summary?.recent_lendings || summary.recent_lendings.length === 0 ? (
              <p className="text-gray-500 text-sm">No recent lending activity</p>
            ) : (
              <div className="space-y-3">
                {summary.recent_lendings.map((lending) => (
                  <div key={lending.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{lending.borrower_name}</p>
                      <p className="text-xs text-gray-600">
                        Asset ID: {lending.asset_id} • {lending.lent_date.toLocaleDateString()}
                      </p>
                    </div>
                    <Badge 
                      variant={lending.status === 'overdue' ? 'destructive' : 
                               lending.status === 'active' ? 'default' : 'secondary'}
                      className="capitalize"
                    >
                      {lending.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Returns */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              📥 Recent Returns
            </CardTitle>
            <CardDescription>Latest assets returned</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i: number) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !summary?.recent_returns || summary.recent_returns.length === 0 ? (
              <p className="text-gray-500 text-sm">No recent return activity</p>
            ) : (
              <div className="space-y-3">
                {summary.recent_returns.map((lending) => (
                  <div key={lending.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{lending.borrower_name}</p>
                      <p className="text-xs text-gray-600">
                        Asset ID: {lending.asset_id} • {lending.actual_return_date?.toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="secondary" className="capitalize">
                      Returned
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}