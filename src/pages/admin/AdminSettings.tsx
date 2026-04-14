import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export default function AdminSettings() {
  const [settings, setSettings] = useState({
    id: '',
    business_name: '',
    working_days: [0, 1, 2, 3, 4] as number[],
    start_time: '09:00',
    end_time: '18:00',
    break_start: '13:00',
    break_end: '14:00',
    slot_duration_minutes: 30,
    advance_booking_days: 30,
    cancellation_hours: 24,
    primary_color: '#6366f1',
    secondary_color: '#ec4899',
    font_family: 'inherit',
    admin_phone: '',
    admin_email: '',
    custom_texts: {} as Record<string, string>,
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data } = await supabase.from('business_settings').select('*').limit(1).single();
    if (data) setSettings({
      id: data.id,
      business_name: data.business_name,
      working_days: data.working_days,
      start_time: data.start_time.substring(0, 5),
      end_time: data.end_time.substring(0, 5),
      break_start: data.break_start?.substring(0, 5) || '',
      break_end: data.break_end?.substring(0, 5) || '',
      slot_duration_minutes: data.slot_duration_minutes,
      advance_booking_days: data.advance_booking_days,
      cancellation_hours: data.cancellation_hours,
      primary_color: (data as any).primary_color || '#6366f1',
      secondary_color: (data as any).secondary_color || '#ec4899',
      font_family: (data as any).font_family || 'inherit',
      admin_phone: (data as any).admin_phone || '',
      admin_email: (data as any).admin_email || '',
      custom_texts: ((data as any).custom_texts as Record<string, string>) || {},
    });
  };

  const handleSave = async () => {
    setLoading(true);
    const { error } = await supabase
      .from('business_settings')
      .update({
        business_name: settings.business_name,
        working_days: settings.working_days,
        start_time: settings.start_time,
        end_time: settings.end_time,
        break_start: settings.break_start || null,
        break_end: settings.break_end || null,
        slot_duration_minutes: settings.slot_duration_minutes,
        advance_booking_days: settings.advance_booking_days,
        cancellation_hours: settings.cancellation_hours,
        primary_color: settings.primary_color,
        secondary_color: settings.secondary_color,
        font_family: settings.font_family,
        admin_phone: settings.admin_phone,
        admin_email: settings.admin_email,
        custom_texts: settings.custom_texts,
      } as any)
      .eq('id', settings.id);
    
    if (error) toast.error('שגיאה בשמירה');
    else toast.success('ההגדרות נשמרו בהצלחה');
    setLoading(false);
  };

  const toggleDay = (day: number) => {
    setSettings(prev => ({
      ...prev,
      working_days: prev.working_days.includes(day)
        ? prev.working_days.filter(d => d !== day)
        : [...prev.working_days, day].sort(),
    }));
  };

  const updateCustomText = (key: string, value: string) => {
    setSettings(prev => ({
      ...prev,
      custom_texts: { ...prev.custom_texts, [key]: value },
    }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { error } = await supabase.storage.from('gallery').upload('logo.png', file, { upsert: true });
    if (error) toast.error('שגיאה בהעלאת הלוגו');
    else toast.success('הלוגו הועלה בהצלחה');
    setUploading(false);
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const fileName = `gallery-${Date.now()}-${file.name}`;
      await supabase.storage.from('gallery').upload(fileName, file);
    }
    toast.success('התמונות הועלו בהצלחה');
    setUploading(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <h1 className="text-2xl font-display font-bold text-foreground">הגדרות העסק</h1>

      <Card className="shadow-card">
        <CardHeader><CardTitle className="text-lg">פרטי העסק</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>שם העסק</Label>
            <Input value={settings.business_name} onChange={e => setSettings({ ...settings, business_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>טלפון אדמין</Label>
              <Input value={settings.admin_phone} onChange={e => setSettings({ ...settings, admin_phone: e.target.value })} placeholder="050-1234567" dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>אימייל אדמין</Label>
              <Input value={settings.admin_email} onChange={e => setSettings({ ...settings, admin_email: e.target.value })} placeholder="admin@email.com" dir="ltr" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader><CardTitle className="text-lg">ימי עבודה</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {DAY_NAMES.map((name, i) => (
              <label key={i} className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={settings.working_days.includes(i)} onCheckedChange={() => toggleDay(i)} />
                <span className="text-sm">{name}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader><CardTitle className="text-lg">שעות פעילות</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>שעת פתיחה</Label>
              <Input type="time" value={settings.start_time} onChange={e => setSettings({ ...settings, start_time: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>שעת סגירה</Label>
              <Input type="time" value={settings.end_time} onChange={e => setSettings({ ...settings, end_time: e.target.value })} dir="ltr" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>תחילת הפסקה</Label>
              <Input type="time" value={settings.break_start} onChange={e => setSettings({ ...settings, break_start: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>סוף הפסקה</Label>
              <Input type="time" value={settings.break_end} onChange={e => setSettings({ ...settings, break_end: e.target.value })} dir="ltr" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader><CardTitle className="text-lg">הגדרות תורים</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>יחידת זמן (דקות)</Label>
              <Input type="number" value={settings.slot_duration_minutes} onChange={e => setSettings({ ...settings, slot_duration_minutes: Number(e.target.value) })} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>הזמנה עד (ימים)</Label>
              <Input type="number" value={settings.advance_booking_days} onChange={e => setSettings({ ...settings, advance_booking_days: Number(e.target.value) })} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>ביטול עד (שעות)</Label>
              <Input type="number" value={settings.cancellation_hours} onChange={e => setSettings({ ...settings, cancellation_hours: Number(e.target.value) })} dir="ltr" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* White Label */}
      <Card className="shadow-card">
        <CardHeader><CardTitle className="text-lg">עיצוב (White Label)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>צבע ראשי</Label>
              <div className="flex items-center gap-2">
                <Input type="color" value={settings.primary_color} onChange={e => setSettings({ ...settings, primary_color: e.target.value })} className="w-12 h-10 p-1 cursor-pointer" />
                <Input value={settings.primary_color} onChange={e => setSettings({ ...settings, primary_color: e.target.value })} dir="ltr" className="flex-1" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>צבע משני</Label>
              <div className="flex items-center gap-2">
                <Input type="color" value={settings.secondary_color} onChange={e => setSettings({ ...settings, secondary_color: e.target.value })} className="w-12 h-10 p-1 cursor-pointer" />
                <Input value={settings.secondary_color} onChange={e => setSettings({ ...settings, secondary_color: e.target.value })} dir="ltr" className="flex-1" />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>פונט</Label>
            <Input value={settings.font_family} onChange={e => setSettings({ ...settings, font_family: e.target.value })} placeholder="inherit, Heebo, Assistant..." dir="ltr" />
          </div>
          <div className="space-y-2">
            <Label>העלאת לוגו</Label>
            <Input type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploading} />
          </div>
          <div className="space-y-2">
            <Label>העלאת תמונות לגלריה</Label>
            <Input type="file" accept="image/*" multiple onChange={handleGalleryUpload} disabled={uploading} />
          </div>
        </CardContent>
      </Card>

      {/* Custom Texts */}
      <Card className="shadow-card">
        <CardHeader><CardTitle className="text-lg">טקסטים מותאמים</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>טקסט אודות</Label>
            <Textarea
              value={settings.custom_texts.about || ''}
              onChange={e => updateCustomText('about', e.target.value)}
              placeholder="הטקסט שיופיע בעמוד אודות"
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label>טקסט נוסף (אודות)</Label>
            <Textarea
              value={settings.custom_texts.about_extra || ''}
              onChange={e => updateCustomText('about_extra', e.target.value)}
              placeholder="פסקה נוספת (אופציונלי)"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Button className="w-full gradient-primary text-primary-foreground" onClick={handleSave} disabled={loading}>
        {loading ? 'שומר...' : 'שמירת הגדרות'}
      </Button>
    </div>
  );
}
