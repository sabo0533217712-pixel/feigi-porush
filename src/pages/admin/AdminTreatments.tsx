import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Clock, Trash2, X, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

interface PriceTier {
  id?: string;
  min_minutes: number;
  max_minutes: number;
  total_price: number;
}

const DEFAULT_COLORS = ['#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF', '#E1BAFF', '#FFBAE1', '#D4BAFF'];

export default function AdminTreatments() {
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Treatment | null>(null);
  const [form, setForm] = useState({
    name: '', description: '', duration_minutes: 30, price: 0, category: '',
    color: '#6366f1', is_variable_duration: false,
  });
  const [priceTiers, setPriceTiers] = useState<PriceTier[]>([]);

  useEffect(() => {
    fetchTreatments();
  }, []);

  const fetchTreatments = async () => {
    const { data } = await supabase.from('treatments').select('*').order('display_order').order('created_at');
    if (data) setTreatments(data as Treatment[]);
  };

  const fetchPriceTiers = async (treatmentId: string) => {
    const { data } = await supabase
      .from('treatment_price_tiers')
      .select('*')
      .eq('treatment_id', treatmentId)
      .order('min_minutes');
    if (data) setPriceTiers(data as unknown as PriceTier[]);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('נא להזין שם טיפול'); return; }

    if (form.is_variable_duration && priceTiers.length === 0) {
      toast.error('נא להגדיר לפחות טווח תמחור אחד');
      return;
    }

    let treatmentId: string | null = null;

    if (editing) {
      const { error } = await supabase.from('treatments').update(form).eq('id', editing.id);
      if (error) { toast.error('שגיאה בעדכון'); return; }
      treatmentId = editing.id;
      toast.success('הטיפול עודכן');
    } else {
      const { data, error } = await supabase.from('treatments').insert(form).select('id').single();
      if (error) { toast.error('שגיאה ביצירת טיפול'); return; }
      treatmentId = data.id;
      toast.success('הטיפול נוצר');
    }

    // Save price tiers for variable duration treatments
    if (treatmentId && form.is_variable_duration) {
      // Delete existing tiers
      await supabase.from('treatment_price_tiers').delete().eq('treatment_id', treatmentId);
      // Insert new tiers
      if (priceTiers.length > 0) {
        const rows = priceTiers.map(t => ({
          treatment_id: treatmentId!,
          min_minutes: t.min_minutes,
          max_minutes: t.max_minutes,
          total_price: t.total_price,
        }));
        await supabase.from('treatment_price_tiers').insert(rows);
      }
    }

    setOpen(false);
    setEditing(null);
    setForm({ name: '', description: '', duration_minutes: 30, price: 0, category: '', color: '#6366f1', is_variable_duration: false });
    setPriceTiers([]);
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

  const openEdit = async (t: Treatment) => {
    setEditing(t);
    setForm({
      name: t.name, description: t.description, duration_minutes: t.duration_minutes,
      price: t.price, category: t.category, color: t.color || '#6366f1',
      is_variable_duration: t.is_variable_duration || false,
    });
    if (t.is_variable_duration) {
      await fetchPriceTiers(t.id);
    } else {
      setPriceTiers([]);
    }
    setOpen(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', description: '', duration_minutes: 30, price: 0, category: '', color: '#6366f1', is_variable_duration: false });
    setPriceTiers([]);
    setOpen(true);
  };

  const addTier = () => {
    const lastMax = priceTiers.length > 0 ? priceTiers[priceTiers.length - 1].max_minutes : 0;
    setPriceTiers([...priceTiers, { min_minutes: lastMax, max_minutes: lastMax + 10, total_price: 0 }]);
  };

  const updateTier = (index: number, field: keyof PriceTier, value: number) => {
    setPriceTiers(prev => prev.map((t, i) => i === index ? { ...t, [field]: value } : t));
  };

  const removeTier = (index: number) => {
    setPriceTiers(prev => prev.filter((_, i) => i !== index));
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
          <DialogContent dir="rtl" className="sm:max-w-md max-h-[85vh] overflow-y-auto">
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
                {!form.is_variable_duration && (
                  <div className="space-y-2">
                    <Label>משך (דקות)</Label>
                    <Input type="number" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: Number(e.target.value) })} />
                  </div>
                )}
                {!form.is_variable_duration && (
                  <div className="space-y-2">
                    <Label>מחיר (₪)</Label>
                    <Input type="number" value={form.price} onChange={e => setForm({ ...form, price: Number(e.target.value) })} />
                  </div>
                )}
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
                  <Label>משך גמיש</Label>
                  <p className="text-xs text-muted-foreground">הלקוחה בוחרת את משך הזמן בעצמה</p>
                </div>
                <Switch
                  checked={form.is_variable_duration}
                  onCheckedChange={v => setForm({ ...form, is_variable_duration: v })}
                />
              </div>

              {/* Price Tiers for variable duration */}
              {form.is_variable_duration && (
                <div className="space-y-3 border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">טווחי תמחור</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addTier} className="gap-1">
                      <Plus className="h-3 w-3" />
                      טווח חדש
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">הגדירי טווחי דקות ומחיר סופי לכל טווח</p>
                  {priceTiers.map((tier, i) => (
                    <div key={i} className="flex items-end gap-2 bg-accent/30 rounded-md p-2">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">מ- (דקות)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={tier.min_minutes}
                          onChange={e => updateTier(i, 'min_minutes', Number(e.target.value))}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">עד (דקות)</Label>
                        <Input
                          type="number"
                          min={tier.min_minutes + 1}
                          value={tier.max_minutes}
                          onChange={e => updateTier(i, 'max_minutes', Number(e.target.value))}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">מחיר סה״כ (₪)</Label>
                        <Input
                          type="number"
                          min={0}
                          step={0.5}
                          value={tier.total_price}
                          onChange={e => updateTier(i, 'total_price', Number(e.target.value))}
                          className="h-8 text-sm"
                        />
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeTier(i)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  {priceTiers.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">לחצי "טווח חדש" להוספת טווח תמחור</p>
                  )}
                </div>
              )}

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
                    {t.is_variable_duration
                      ? <span className="text-xs bg-accent px-2 py-0.5 rounded flex items-center gap-1"><Clock className="h-3 w-3" />משך גמיש • תמחור לפי דקות</span>
                      : <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{t.duration_minutes} דק׳</span>
                    }
                    {!t.is_variable_duration && <span>₪{t.price}</span>}
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
