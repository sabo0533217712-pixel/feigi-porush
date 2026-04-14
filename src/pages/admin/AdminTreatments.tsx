import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Clock, Trash2 } from 'lucide-react';

interface Treatment {
  id: string;
  name: string;
  description: string;
  duration_minutes: number;
  price: number;
  category: string;
  is_active: boolean;
  color: string;
  is_variable_duration: boolean;
}

const DEFAULT_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6'];

export default function AdminTreatments() {
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Treatment | null>(null);
  const [form, setForm] = useState({
    name: '', description: '', duration_minutes: 30, price: 0, category: '',
    color: '#6366f1', is_variable_duration: false,
  });

  useEffect(() => {
    fetchTreatments();
  }, []);

  const fetchTreatments = async () => {
    const { data } = await supabase.from('treatments').select('*').order('created_at');
    if (data) setTreatments(data as Treatment[]);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('נא להזין שם טיפול'); return; }

    if (editing) {
      const { error } = await supabase.from('treatments').update(form).eq('id', editing.id);
      if (error) toast.error('שגיאה בעדכון');
      else toast.success('הטיפול עודכן');
    } else {
      const { error } = await supabase.from('treatments').insert(form);
      if (error) toast.error('שגיאה ביצירת טיפול');
      else toast.success('הטיפול נוצר');
    }
    setOpen(false);
    setEditing(null);
    setForm({ name: '', description: '', duration_minutes: 30, price: 0, category: '', color: '#6366f1', is_variable_duration: false });
    fetchTreatments();
  };

  const toggleActive = async (t: Treatment) => {
    await supabase.from('treatments').update({ is_active: !t.is_active }).eq('id', t.id);
    fetchTreatments();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('treatments').delete().eq('id', id);
    if (error) toast.error('לא ניתן למחוק טיפול שיש לו תורים');
    else { toast.success('הטיפול נמחק'); fetchTreatments(); }
  };

  const openEdit = (t: Treatment) => {
    setEditing(t);
    setForm({
      name: t.name, description: t.description, duration_minutes: t.duration_minutes,
      price: t.price, category: t.category, color: t.color || '#6366f1',
      is_variable_duration: t.is_variable_duration || false,
    });
    setOpen(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', description: '', duration_minutes: 30, price: 0, category: '', color: '#6366f1', is_variable_duration: false });
    setOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold text-foreground">ניהול טיפולים</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground gap-2" onClick={openNew}>
              <Plus className="h-4 w-4" />
              טיפול חדש
            </Button>
          </DialogTrigger>
          <DialogContent dir="rtl" className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editing ? 'עריכת טיפול' : 'טיפול חדש'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>שם הטיפול</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="למשל: טיפול פנים" />
              </div>
              <div className="space-y-2">
                <Label>תיאור</Label>
                <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="תיאור קצר" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>משך (דקות)</Label>
                  <Input type="number" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>מחיר (₪)</Label>
                  <Input type="number" value={form.price} onChange={e => setForm({ ...form, price: Number(e.target.value) })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>קטגוריה</Label>
                <Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="למשל: פנים, גוף" />
              </div>

              {/* Color Picker */}
              <div className="space-y-2">
                <Label>צבע</Label>
                <div className="flex items-center gap-2 flex-wrap">
                  {DEFAULT_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      className={`w-8 h-8 rounded-full border-2 transition-transform ${form.color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                      onClick={() => setForm({ ...form, color: c })}
                    />
                  ))}
                  <Input
                    type="color"
                    value={form.color}
                    onChange={e => setForm({ ...form, color: e.target.value })}
                    className="w-10 h-8 p-0 border-0 cursor-pointer"
                  />
                </div>
              </div>

              {/* Variable Duration Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>משך משתנה</Label>
                  <p className="text-xs text-muted-foreground">הלקוחה יכולה לקבל זמן קצר יותר</p>
                </div>
                <Switch
                  checked={form.is_variable_duration}
                  onCheckedChange={v => setForm({ ...form, is_variable_duration: v })}
                />
              </div>

              <Button className="w-full gradient-primary text-primary-foreground" onClick={handleSave}>שמירה</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3">
        {treatments.map(t => (
          <Card key={t.id} className={`shadow-card transition-opacity ${!t.is_active ? 'opacity-50' : ''}`}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: t.color || '#6366f1' }} />
                <div>
                  <h3 className="font-medium text-foreground">{t.name}</h3>
                  <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{t.duration_minutes} דק׳</span>
                    <span>₪{t.price}</span>
                    {t.category && <span>{t.category}</span>}
                    {t.is_variable_duration && <span className="text-xs bg-accent px-2 py-0.5 rounded">משך משתנה</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={t.is_active} onCheckedChange={() => toggleActive(t)} />
                <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)} className="text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {treatments.length === 0 && (
          <p className="text-center text-muted-foreground py-8">עדיין לא הוגדרו טיפולים</p>
        )}
      </div>
    </div>
  );
}
