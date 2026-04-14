import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, X, Trash2 } from 'lucide-react';
import { applyThemeFromImage } from '@/hooks/useBusinessTheme';

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

interface DayBreak {
  start: string;
  end: string;
}

interface DaySchedule {
  start: string;
  end: string;
  breaks: DayBreak[];
}

type DaySchedules = Record<string, DaySchedule>;

const DEFAULT_SCHEDULE: DaySchedule = { start: '09:00', end: '18:00', breaks: [{ start: '13:00', end: '14:00' }] };

function hexToHSL(hex: string): { h: number; s: number; l: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function extractDominantColor(imgElement: HTMLImageElement): string | null {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const size = 50;
  canvas.width = size;
  canvas.height = size;
  ctx.drawImage(imgElement, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;
  let rSum = 0, gSum = 0, bSum = 0, count = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    // Skip transparent/near-white/near-black pixels
    if (a < 128) continue;
    if (r > 240 && g > 240 && b > 240) continue;
    if (r < 15 && g < 15 && b < 15) continue;
    rSum += r; gSum += g; bSum += b; count++;
  }
  if (count === 0) return null;
  const rAvg = Math.round(rSum / count);
  const gAvg = Math.round(gSum / count);
  const bAvg = Math.round(bSum / count);
  return `#${rAvg.toString(16).padStart(2, '0')}${gAvg.toString(16).padStart(2, '0')}${bAvg.toString(16).padStart(2, '0')}`;
}

export default function AdminSettings() {
  const [settings, setSettings] = useState({
    id: '',
    business_name: '',
    working_days: [0, 1, 2, 3, 4] as number[],
    slot_duration_minutes: 30,
    advance_booking_days: 30,
    cancellation_hours: 24,
    admin_phone: '',
    admin_email: '',
    custom_texts: {} as Record<string, string>,
    day_schedules: {} as DaySchedules,
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [galleryImages, setGalleryImages] = useState<{ name: string; url: string }[]>([]);

  useEffect(() => {
    fetchSettings();
    fetchLogo();
    fetchGalleryImages();
  }, []);

  const fetchSettings = async () => {
    const { data } = await supabase.from('business_settings').select('*').limit(1).single();
    if (data) {
      const ds = ((data as any).day_schedules as DaySchedules) || {};
      setSettings({
        id: data.id,
        business_name: data.business_name,
        working_days: data.working_days,
        slot_duration_minutes: data.slot_duration_minutes,
        advance_booking_days: data.advance_booking_days,
        cancellation_hours: data.cancellation_hours,
        admin_phone: (data as any).admin_phone || '',
        admin_email: (data as any).admin_email || '',
        custom_texts: ((data as any).custom_texts as Record<string, string>) || {},
        day_schedules: ds,
      });
    }
  };

  const fetchLogo = async () => {
    const { data } = await supabase.storage.from('gallery').list('', { search: 'logo' });
    if (data && data.length > 0) {
      const logoFile = data.find(f => f.name.startsWith('logo'));
      if (logoFile) {
        const { data: urlData } = supabase.storage.from('gallery').getPublicUrl(logoFile.name);
        setLogoUrl(urlData.publicUrl + '?t=' + Date.now());
      }
    }
  };

  const fetchGalleryImages = async () => {
    const { data } = await supabase.storage.from('gallery').list('', { limit: 100 });
    if (data) {
      const images = data
        .filter(f => f.name.startsWith('gallery-'))
        .map(f => ({
          name: f.name,
          url: supabase.storage.from('gallery').getPublicUrl(f.name).data.publicUrl,
        }));
      setGalleryImages(images);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    const { error } = await supabase
      .from('business_settings')
      .update({
        business_name: settings.business_name,
        working_days: settings.working_days,
        slot_duration_minutes: settings.slot_duration_minutes,
        advance_booking_days: settings.advance_booking_days,
        cancellation_hours: settings.cancellation_hours,
        admin_phone: settings.admin_phone,
        admin_email: settings.admin_email,
        custom_texts: settings.custom_texts,
        day_schedules: settings.day_schedules,
        // Keep legacy fields synced from first working day as fallback
        start_time: Object.values(settings.day_schedules)[0]?.start || '09:00',
        end_time: Object.values(settings.day_schedules)[0]?.end || '18:00',
        break_start: Object.values(settings.day_schedules)[0]?.breaks?.[0]?.start || null,
        break_end: Object.values(settings.day_schedules)[0]?.breaks?.[0]?.end || null,
      } as any)
      .eq('id', settings.id);

    if (error) toast.error('שגיאה בשמירה');
    else toast.success('ההגדרות נשמרו בהצלחה');
    setLoading(false);
  };

  const toggleDay = (day: number) => {
    setSettings(prev => {
      const isActive = prev.working_days.includes(day);
      const newDays = isActive
        ? prev.working_days.filter(d => d !== day)
        : [...prev.working_days, day].sort();
      const newSchedules = { ...prev.day_schedules };
      if (!isActive && !newSchedules[String(day)]) {
        newSchedules[String(day)] = { ...DEFAULT_SCHEDULE, breaks: [...DEFAULT_SCHEDULE.breaks] };
      }
      if (isActive) {
        delete newSchedules[String(day)];
      }
      return { ...prev, working_days: newDays, day_schedules: newSchedules };
    });
  };

  const updateDaySchedule = (day: number, field: 'start' | 'end', value: string) => {
    setSettings(prev => ({
      ...prev,
      day_schedules: {
        ...prev.day_schedules,
        [String(day)]: {
          ...(prev.day_schedules[String(day)] || DEFAULT_SCHEDULE),
          [field]: value,
        },
      },
    }));
  };

  const addBreak = (day: number) => {
    setSettings(prev => {
      const sch = prev.day_schedules[String(day)] || { ...DEFAULT_SCHEDULE };
      return {
        ...prev,
        day_schedules: {
          ...prev.day_schedules,
          [String(day)]: { ...sch, breaks: [...sch.breaks, { start: '13:00', end: '14:00' }] },
        },
      };
    });
  };

  const removeBreak = (day: number, index: number) => {
    setSettings(prev => {
      const sch = prev.day_schedules[String(day)];
      if (!sch) return prev;
      return {
        ...prev,
        day_schedules: {
          ...prev.day_schedules,
          [String(day)]: { ...sch, breaks: sch.breaks.filter((_, i) => i !== index) },
        },
      };
    });
  };

  const updateBreak = (day: number, index: number, field: 'start' | 'end', value: string) => {
    setSettings(prev => {
      const sch = prev.day_schedules[String(day)];
      if (!sch) return prev;
      const newBreaks = [...sch.breaks];
      newBreaks[index] = { ...newBreaks[index], [field]: value };
      return {
        ...prev,
        day_schedules: {
          ...prev.day_schedules,
          [String(day)]: { ...sch, breaks: newBreaks },
        },
      };
    });
  };

  const updateCustomText = (key: string, value: string) => {
    setSettings(prev => ({
      ...prev,
      custom_texts: { ...prev.custom_texts, [key]: value },
    }));
  };

  const applyLogoColors = async (imageUrl: string) => {
    const hex = await applyThemeFromImage(imageUrl);
    if (hex) {
      // Save extracted color to DB
      await supabase.from('business_settings').update({
        primary_color: hex,
      } as any).eq('id', settings.id);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { error } = await supabase.storage.from('gallery').upload('logo.png', file, { upsert: true });
    if (error) {
      toast.error('שגיאה בהעלאת הלוגו');
    } else {
      toast.success('הלוגו הועלה בהצלחה');
      const { data: urlData } = supabase.storage.from('gallery').getPublicUrl('logo.png');
      const newUrl = urlData.publicUrl + '?t=' + Date.now();
      setLogoUrl(newUrl);
      applyLogoColors(newUrl);
    }
    setUploading(false);
  };

  const handleDeleteLogo = async () => {
    const { error } = await supabase.storage.from('gallery').remove(['logo.png']);
    if (error) toast.error('שגיאה במחיקת הלוגו');
    else { toast.success('הלוגו נמחק'); setLogoUrl(null); }
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
    await fetchGalleryImages();
    setUploading(false);
  };

  const handleDeleteGalleryImage = async (name: string) => {
    const { error } = await supabase.storage.from('gallery').remove([name]);
    if (error) toast.error('שגיאה במחיקת התמונה');
    else {
      toast.success('התמונה נמחקה');
      setGalleryImages(prev => prev.filter(img => img.name !== name));
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <h1 className="text-2xl font-display font-bold text-foreground">הגדרות העסק</h1>

      {/* Business Details */}
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

      {/* Working Days + Per-Day Schedules */}
      <Card className="shadow-card">
        <CardHeader><CardTitle className="text-lg">ימי ושעות עבודה</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {DAY_NAMES.map((name, i) => {
            const isActive = settings.working_days.includes(i);
            const schedule = settings.day_schedules[String(i)] || DEFAULT_SCHEDULE;
            return (
              <div key={i} className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={isActive} onCheckedChange={() => toggleDay(i)} />
                  <span className="text-sm font-medium">{name}</span>
                </label>
                {isActive && (
                  <div className="mr-6 space-y-2 p-3 bg-muted/50 rounded-lg">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">פתיחה</Label>
                        <Input type="time" value={schedule.start} onChange={e => updateDaySchedule(i, 'start', e.target.value)} dir="ltr" className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">סגירה</Label>
                        <Input type="time" value={schedule.end} onChange={e => updateDaySchedule(i, 'end', e.target.value)} dir="ltr" className="h-8 text-sm" />
                      </div>
                    </div>
                    {/* Breaks */}
                    {schedule.breaks.map((brk, bi) => (
                      <div key={bi} className="flex items-end gap-2">
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">הפסקה {bi + 1} - התחלה</Label>
                            <Input type="time" value={brk.start} onChange={e => updateBreak(i, bi, 'start', e.target.value)} dir="ltr" className="h-8 text-sm" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">סיום</Label>
                            <Input type="time" value={brk.end} onChange={e => updateBreak(i, bi, 'end', e.target.value)} dir="ltr" className="h-8 text-sm" />
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeBreak(i, bi)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => addBreak(i)}>
                      <Plus className="h-3 w-3" /> הוסף הפסקה
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Appointment Settings */}
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

      {/* Branding - Logo driven */}
      <Card className="shadow-card">
        <CardHeader><CardTitle className="text-lg">עיצוב (לוגו)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">העלי לוגו — הצבעים של האתר יתעדכנו אוטומטית לפי הלוגו</p>
          <div className="space-y-2">
            <Label>העלאת לוגו</Label>
            <Input type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploading} />
          </div>
          {logoUrl && (
            <div className="flex items-start gap-4 p-3 bg-muted/50 rounded-lg">
              <img src={logoUrl} alt="לוגו" className="h-20 w-20 object-contain rounded" />
              <Button variant="ghost" size="sm" className="text-destructive gap-1" onClick={handleDeleteLogo}>
                <Trash2 className="h-4 w-4" /> מחיקת לוגו
              </Button>
            </div>
          )}

          <div className="space-y-2 pt-2">
            <Label>העלאת תמונות לגלריה</Label>
            <Input type="file" accept="image/*" multiple onChange={handleGalleryUpload} disabled={uploading} />
          </div>
          {galleryImages.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {galleryImages.map(img => (
                <div key={img.name} className="relative group">
                  <img src={img.url} alt="" className="h-20 w-full object-cover rounded" />
                  <button
                    onClick={() => handleDeleteGalleryImage(img.name)}
                    className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
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
