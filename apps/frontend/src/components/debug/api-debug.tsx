'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import api from '@/lib/axios';

export function ApiDebug() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testConversationsApi = async () => {
    setLoading(true);
    try {
      // Log current state
      const currentState = {
        tenantSlug: localStorage.getItem('tenantSlug'),
        accessToken: localStorage.getItem('accessToken') ? 'Present' : 'Missing',
        hostname: window.location.hostname,
      };

      console.log('Current state:', currentState);

      // Make API call
      const response = await api.get('/api/conversations', {
        params: { limit: 10 }
      });

      setResult({
        success: true,
        currentState,
        data: response.data,
        headers: response.config.headers,
      });
    } catch (error: any) {
      setResult({
        success: false,
        currentState: {
          tenantSlug: localStorage.getItem('tenantSlug'),
          accessToken: localStorage.getItem('accessToken') ? 'Present' : 'Missing',
          hostname: window.location.hostname,
        },
        error: {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const clearTenantSlug = () => {
    localStorage.removeItem('tenantSlug');
    setResult({ message: 'Tenant slug cleared from localStorage' });
  };

  const setTenantSlug = () => {
    localStorage.setItem('tenantSlug', 'hoteis-reserva');
    setResult({ message: 'Tenant slug set to: hoteis-reserva' });
  };

  return (
    <Card className="m-4">
      <CardHeader>
        <CardTitle>API Debug Panel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          <Button onClick={testConversationsApi} disabled={loading}>
            {loading ? 'Testing...' : 'Test Conversations API'}
          </Button>
          <Button onClick={setTenantSlug} variant="outline">
            Set Tenant Slug
          </Button>
          <Button onClick={clearTenantSlug} variant="outline">
            Clear Tenant Slug
          </Button>
        </div>

        {result && (
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <h3 className="font-semibold mb-2">
              Result: {result.success ? '✅ Success' : '❌ Error'}
            </h3>
            <pre className="text-xs overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}