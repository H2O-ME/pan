'use client';

import { useState, useEffect } from 'react';
import { CheckCircle,
  AlertCircle,
  ExternalLink,
  Loader2,
  ShieldCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface AuthProviderProps {
  children: React.ReactNode;
}

export default function AuthProvider({ children }: AuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    setIsLoading(false);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isVerifying) return;
    
    setError('');
    setIsVerifying(true);

    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (data.success) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__APP_KEY__ = password;
        setIsAuthenticated(true);
      } else {
        setError('访问密码不正确，请重新输入');
      }
    } catch {
      setError('网络连接异常，请稍后重试');
    } finally {
      setIsVerifying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50" suppressHydrationWarning>
        <Loader2 className="w-8 h-8 text-zinc-900 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-4 selection:bg-zinc-900 selection:text-white">
        <div className="w-full max-w-[420px] space-y-8">
          <div className="flex flex-col items-center text-center space-y-2">
            <div 
              className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center shadow-lg shadow-black/10 mb-4 active:scale-90 transition-transform cursor-pointer"
              onClick={() => window.location.reload()}
            >
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">GitCloud</h1>
          </div>

          <Card className="border-zinc-200 shadow-xl shadow-black/5 rounded-3xl overflow-hidden bg-white">
            <CardHeader className="space-y-1.5 pb-6 pt-8 text-center">
              <CardTitle className="text-2xl font-extrabold text-zinc-900 tracking-tight">身份验证</CardTitle>
              <CardDescription className="text-zinc-500 font-medium">请输入您的访问密码以访问存储空间</CardDescription>
            </CardHeader>
            <CardContent className="pb-8 px-8">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <div className="relative">
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="输入访问密码"
                      required
                      autoFocus
                      className={cn(
                        "h-14 bg-zinc-50/50 border-zinc-200 rounded-2xl transition-all focus-visible:ring-zinc-950 focus-visible:border-zinc-950 text-base px-5 text-zinc-950 font-medium",
                        error && "border-red-200 bg-red-50/30 focus-visible:ring-red-500"
                      )}
                    />
                  </div>
                  
                  {error && (
                    <div className="flex items-center justify-center gap-2 text-red-600 px-1 pt-1">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-sm font-semibold">{error}</span>
                    </div>
                  )}
                </div>

                <Button 
                  type="submit" 
                  disabled={isVerifying}
                  className="w-full h-14 bg-zinc-950 hover:bg-zinc-800 text-white font-bold rounded-2xl shadow-xl shadow-black/10 transition-all active:scale-[0.98] text-base mt-2"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      正在验证...
                    </>
                  ) : (
                    "解锁存储空间"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
          
          <div className="text-center">
            <a 
              href="https://blog.tianhw.top" 
              target="_blank" 
              rel="noopener noreferrer"
              className="group flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full pointer-events-auto select-none transition-all duration-300 hover:bg-zinc-100/50 active:scale-95 mx-auto w-fit"
            >
              <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-[0.4em] group-hover:text-zinc-500 transition-colors">
                Powered by THW
              </span>
              <ExternalLink className="w-2.5 h-2.5 text-zinc-200 group-hover:text-zinc-400 transition-colors" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
