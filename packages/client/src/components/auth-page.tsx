import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/use-auth-store';
import { post } from '@/services/http';

export function AuthPage() {
  const registered = useAuthStore((s) => s.registered);
  const setToken = useAuthStore((s) => s.setToken);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isLogin = registered === true;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const data = await post<{ token: string }>(endpoint, { email, password });
      setToken(data.token);
    } catch {
      setError(isLogin ? 'Invalid email or password' : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <form onSubmit={handleSubmit} className="w-full max-w-sm p-6 space-y-4 border border-border rounded-lg">
        <div>
          <h1 className="text-xl font-semibold text-foreground">reqtrace</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isLogin ? 'Sign in to your dashboard' : 'Create your admin account'}
          </p>
        </div>
        <div className="space-y-3">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? '...' : isLogin ? 'Sign in' : 'Create account'}
        </Button>
      </form>
    </div>
  );
}
