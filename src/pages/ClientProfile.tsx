import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { Save, User, Mail, Phone, Bell, MessageCircle, ShieldCheck } from 'lucide-react';

export default function ClientProfile() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [reminderPref, setReminderPref] = useState('whatsapp');
  const [secQuestion, setSecQuestion] = useState('');
  const [secAnswer, setSecAnswer] = useState('');
  const [hasSecurity, setHasSecurity] = useState(false);
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user!.id)
      .single();
    if (data) {
      setFullName(data.full_name || '');
      setEmail(data.email || '');
      setPhone(data.phone || '');
      const pref = data.reminder_preference === 'sms' ? 'whatsapp' : (data.reminder_preference || 'whatsapp');
      setReminderPref(pref);
      setSecQuestion(data.security_question || '');
      setHasSecurity(!!data.security_question && !!data.security_answer_hash);
    }
    setLoading(false);
  };

  const handleSaveSecurity = async () => {
    if (secQuestion.trim().length < 3) return toast.error('שאלת אבטחה קצרה מדי');
    if (secAnswer.trim().length < 2) return toast.error('נא להזין תשובה');
    setSavingSecurity(true);
    const { error } = await supabase.rpc('set_security_question', {
      _question: secQuestion.trim(),
      _answer: secAnswer.trim(),
    });
    setSavingSecurity(false);
    if (error) {
      toast.error('שגיאה בשמירת שאלת האבטחה');
    } else {
      toast.success('שאלת האבטחה נשמרה');
      setSecAnswer('');
      setHasSecurity(true);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        reminder_preference: reminderPref,
      })
      .eq('user_id', user.id);

    if (error) {
      toast.error('שגיאה בשמירת הפרטים');
    } else {
      toast.success('הפרטים עודכנו בהצלחה');
    }
    setSaving(false);
  };

  if (loading) {
    return <p className="text-center text-muted-foreground py-8">טוען...</p>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <h1 className="text-2xl font-display font-bold text-foreground">הפרופיל שלי</h1>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5" />
            פרטים אישיים
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">שם מלא</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="השם המלא שלך"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              אימייל
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="example@email.com"
              dir="ltr"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" />
              מספר טלפון
            </Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="050-1234567"
              dir="ltr"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5" />
            העדפת תזכורות
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={reminderPref} onValueChange={setReminderPref} className="space-y-3">
            <div className="flex items-center gap-3">
              <RadioGroupItem value="email" id="pref-email" />
              <Label htmlFor="pref-email" className="flex items-center gap-2 cursor-pointer">
                <Mail className="h-4 w-4 text-muted-foreground" />
                אימייל
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <RadioGroupItem value="whatsapp" id="pref-whatsapp" />
              <Label htmlFor="pref-whatsapp" className="flex items-center gap-2 cursor-pointer">
                <MessageCircle className="h-4 w-4 text-muted-foreground" />
                WhatsApp
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            שאלת אבטחה
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {hasSecurity
              ? 'שאלת האבטחה הוגדרה. אפשר לעדכן כאן בכל עת. התשובה הקיימת שמורה מוצפנת ולא מוצגת.'
              : 'הגדירי שאלה ותשובה אישית — תשמש לאיפוס סיסמה במקרה ששכחת.'}
          </p>
          <div className="space-y-2">
            <Label htmlFor="sec-q">שאלה</Label>
            <Input id="sec-q" value={secQuestion} onChange={e => setSecQuestion(e.target.value)} placeholder="לדוגמה: שם החיה הראשונה שלי" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sec-a">תשובה {hasSecurity && <span className="text-xs text-muted-foreground">(הזיני רק אם את רוצה לעדכן)</span>}</Label>
            <Input id="sec-a" value={secAnswer} onChange={e => setSecAnswer(e.target.value)} placeholder="התשובה הסודית שלך" />
          </div>
          <Button variant="outline" className="w-full" onClick={handleSaveSecurity} disabled={savingSecurity}>
            {savingSecurity ? 'שומר...' : 'שמור שאלת אבטחה'}
          </Button>
        </CardContent>
      </Card>

      <Button
        className="w-full gradient-primary text-primary-foreground"
        onClick={handleSave}
        disabled={saving}
      >
        <Save className="h-4 w-4 ml-2" />
        {saving ? 'שומר...' : 'שמור שינויים'}
      </Button>
    </div>
  );
}
