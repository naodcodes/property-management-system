import { createClient } from '@/lib/supabase/client';

export function useApi() {
  const supabase = createClient();

  const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const res = await fetch(endpoint, {
      ...options,
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Something went wrong');
    }

    return res.json();
  };

  return { apiRequest };
}