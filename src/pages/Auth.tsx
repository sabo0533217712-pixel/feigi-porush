import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';

export default function Auth() {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const [loading, setLoading] = useState(false);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(loginEmail, loginPassword);
      toast.success('התחברת בהצלחה!');
      navigate('/');
    } catch (err: any) {
      toast.error(err.message || 'שגיאה בהתחברות');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim()) {
      toast.error('נא להזין שם מלא');
      return;
    }
    setLoading(true);
    try {
      await signUp(regEmail, regPassword, regName, regPhone);
      toast.success('נרשמת בהצלחה! בדקי את המייל לאישור');
    } catch (err: any) {
      toast.error(err.message || 'שגיאה בהרשמה');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-display font-bold text-foreground">ביוטי בוק</h1>
          <p className="text-muted-foreground mt-2">מערכת ניהול תורים לקוסמטיקאית</p>
        </div>

        <Card className="shadow-card border-border/50">
          <Tabs defaultValue="login" dir="rtl">
            <CardHeader className="pb-2">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">התחברות</TabsTrigger>
                <TabsTrigger value="register">הרשמה</TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent>
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">אימייל</Label>
                    <Input id="login-email" type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required placeholder="your@email.com" dir="ltr" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">סיסמה</Label>
                    <Input id="login-password" type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required placeholder="••••••••" dir="ltr" />
                  </div>
                  <Button type="submit" className="w-full gradient-primary text-primary-foreground" disabled={loading}>
                    {loading ? 'מתחבר...' : 'התחברי'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-name">שם מלא</Label>
                    <Input id="reg-name" value={regName} onChange={e => setRegName(e.target.value)} required placeholder="שם מלא" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-phone">טלפון</Label>
                    <Input id="reg-phone" value={regPhone} onChange={e => setRegPhone(e.target.value)} placeholder="050-1234567" dir="ltr" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-email">אימייל</Label>
                    <Input id="reg-email" type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} required placeholder="your@email.com" dir="ltr" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-password">סיסמה</Label>
                    <Input id="reg-password" type="password" value={regPassword} onChange={e => setRegPassword(e.target.value)} required minLength={6} placeholder="לפחות 6 תווים" dir="ltr" />
                  </div>
                  <Button type="submit" className="w-full gradient-primary text-primary-foreground" disabled={loading}>
                    {loading ? 'נרשם...' : 'הרשמי'}
                  </Button>
                </form>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
