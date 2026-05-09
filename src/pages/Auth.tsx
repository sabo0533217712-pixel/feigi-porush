import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import Brand from '@/components/Brand';

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

  // Forgot password dialog
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  // Password recovery (after clicking link in email)
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      toast.error('נא להזין אימייל');
      return;
    }
    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      toast.success('קישור לאיפוס סיסמה נשלח למייל');
      setForgotOpen(false);
      setForgotEmail('');
    } catch (err: any) {
      toast.error(err.message || 'שגיאה בשליחת הקישור');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('סיסמה חייבת להיות לפחות 6 תווים');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      toast.error('הסיסמאות אינן תואמות');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('הסיסמה עודכנה בהצלחה!');
      setRecoveryMode(false);
      setNewPassword('');
      setNewPasswordConfirm('');
      navigate('/');
    } catch (err: any) {
      toast.error(err.message || 'שגיאה בעדכון הסיסמה');
    } finally {
      setLoading(false);
    }
  };

  if (recoveryMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md animate-fade-in">
          <div className="text-center mb-8">
            <Brand size="lg" linkTo="/" />
            <p className="text-muted-foreground mt-3">איפוס סיסמה</p>
          </div>
          <Card className="shadow-card border-border/50">
            <CardHeader />
            <CardContent>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">סיסמה חדשה</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="לפחות 6 תווים"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password-confirm">אימות סיסמה</Label>
                  <Input
                    id="new-password-confirm"
                    type="password"
                    value={newPasswordConfirm}
                    onChange={(e) => setNewPasswordConfirm(e.target.value)}
                    required
                    minLength={6}
                    dir="ltr"
                  />
                </div>
                <Button type="submit" className="w-full gradient-primary text-primary-foreground" disabled={loading}>
                  {loading ? 'מעדכן...' : 'עדכון סיסמה'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <Brand size="lg" linkTo="/" />
          <p className="text-muted-foreground mt-3">מערכת קביעת תורים</p>
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
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setForgotEmail(loginEmail);
                        setForgotOpen(true);
                      }}
                      className="text-sm text-primary hover:underline"
                    >
                      שכחתי סיסמה
                    </button>
                  </div>
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

        <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>איפוס סיסמה</DialogTitle>
              <DialogDescription>הזיני את כתובת המייל ונשלח לך קישור לאיפוס הסיסמה</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email">אימייל</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                  placeholder="your@email.com"
                  dir="ltr"
                />
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full gradient-primary text-primary-foreground" disabled={forgotLoading}>
                  {forgotLoading ? 'שולח...' : 'שליחת קישור'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
