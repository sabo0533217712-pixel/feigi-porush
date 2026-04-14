import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format, parseISO, addDays, startOfWeek, endOfWeek } from 'date-fns';
import { he } from 'date-fns/locale';
import { getHebrewDateShort, getHebrewDate } from '@/lib/hebrew-date';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Phone, Mail, MessageCircle, MessageSquare, Plus, CalendarDays, List } from 'lucide-react';

interface Treatment {
  id: string;
  name: string;
  color: string;
  duration_minutes: number;
  price: number;
}

interface Appointment {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  booked_by_admin: boolean;
  treatment_id: string;
  client_id: string;
  profiles: { full_name: string; phone: string; user_id: string } | null;
  treatments: { name: string; color: string } | null;
}

interface Profile {
  user_id: string;
  full_name: string;
  phone: string;
}

export default function AdminCalendar() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [weekAppointments, setWeekAppointments] = useState<Appointment[]>([]);
  const [showBookDialog, setShowBookDialog] = useState(false);
  const [bookForm, setBookForm] = useState({
    client_id: '', treatment_id: '', date: format(new Date(), 'yyyy-MM-dd'),
    start_time: '09:00', end_time: '09:30',
  });

  useEffect(() => {
    fetchTreatments();
    fetchProfiles();
  }, []);

  useEffect(() => {
    if (viewMode === 'day') fetchAppointments();
    else fetchWeekAppointments();
  }, [selectedDate, viewMode]);

  const fetchTreatments = async () => {
    const { data } = await supabase.from('treatments').select('id, name, color, duration_minutes, price').eq('is_active', true);
    if (data) setTreatments(data as Treatment[]);
  };

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('user_id, full_name, phone');
    if (data) setProfiles(data);
  };

  const fetchAppointments = async () => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const { data } = await supabase
      .from('appointments')
      .select('*, treatments(name, color)')
      .eq('appointment_date', dateStr)
      .order('start_time');

    if (data && data.length > 0) {
      const clientIds = [...new Set(data.map(a => a.client_id))];
      const { data: profs } = await supabase.from('profiles').select('user_id, full_name, phone').in('user_id', clientIds);
      const profileMap = new Map(profs?.map(p => [p.user_id, p]) || []);
      setAppointments(data.map(a => ({ ...a, profiles: profileMap.get(a.client_id) || null })) as unknown as Appointment[]);
    } else {
      setAppointments(data as unknown as Appointment[] || []);
    }
  };

  const fetchWeekAppointments = async () => {
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 0 });
    const { data } = await supabase
      .from('appointments')
      .select('*, treatments(name, color)')
      .gte('appointment_date', format(weekStart, 'yyyy-MM-dd'))
      .lte('appointment_date', format(weekEnd, 'yyyy-MM-dd'))
      .order('start_time');

    if (data && data.length > 0) {
      const clientIds = [...new Set(data.map(a => a.client_id))];
      const { data: profs } = await supabase.from('profiles').select('user_id, full_name, phone').in('user_id', clientIds);
      const profileMap = new Map(profs?.map(p => [p.user_id, p]) || []);
      setWeekAppointments(data.map(a => ({ ...a, profiles: profileMap.get(a.client_id) || null })) as unknown as Appointment[]);
    } else {
      setWeekAppointments(data as unknown as Appointment[] || []);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('appointments').update({ status }).eq('id', id);
    if (error) toast.error('שגיאה בעדכון');
    else { toast.success('הסטטוס עודכן'); viewMode === 'day' ? fetchAppointments() : fetchWeekAppointments(); }
  };

  const handleAdminBook = async () => {
    if (!bookForm.client_id || !bookForm.treatment_id) {
      toast.error('נא לבחור לקוחה וטיפול');
      return;
    }
    const { error } = await supabase.from('appointments').insert({
      client_id: bookForm.client_id,
      treatment_id: bookForm.treatment_id,
      appointment_date: bookForm.date,
      start_time: bookForm.start_time,
      end_time: bookForm.end_time,
      booked_by_admin: true,
    });
    if (error) toast.error('שגיאה בקביעת תור');
    else {
      toast.success('התור נקבע בהצלחה');
      setShowBookDialog(false);
      viewMode === 'day' ? fetchAppointments() : fetchWeekAppointments();
    }
  };

  const onTreatmentSelect = (treatmentId: string) => {
    const t = treatments.find(tr => tr.id === treatmentId);
    if (t) {
      const [h, m] = bookForm.start_time.split(':').map(Number);
      const endMin = h * 60 + m + t.duration_minutes;
      const endTime = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
      setBookForm(prev => ({ ...prev, treatment_id: treatmentId, end_time: endTime }));
    }
  };

  // Build hours array for weekly view
  const hours = Array.from({ length: 12 }, (_, i) => i + 8); // 08:00 to 19:00
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Legend: unique treatments from current appointments
  const usedTreatments = viewMode === 'day' ? appointments : weekAppointments;
  const legendItems = [...new Map(usedTreatments.map(a => [a.treatments?.name, a.treatments?.color])).entries()]
    .filter(([name]) => name);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-display font-bold text-foreground">יומן תורים</h1>
        <div className="flex items-center gap-2">
          <div className="flex border border-border rounded-lg overflow-hidden">
            <Button variant={viewMode === 'day' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('day')} className="rounded-none gap-1">
              <List className="h-4 w-4" /> יומי
            </Button>
            <Button variant={viewMode === 'week' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('week')} className="rounded-none gap-1">
              <CalendarDays className="h-4 w-4" /> שבועי
            </Button>
          </div>
          <Button className="gradient-primary text-primary-foreground gap-2" onClick={() => {
            setBookForm(prev => ({ ...prev, date: format(selectedDate, 'yyyy-MM-dd') }));
            setShowBookDialog(true);
          }}>
            <Plus className="h-4 w-4" /> תור חדש
          </Button>
        </div>
      </div>

      {/* Legend */}
      {legendItems.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {legendItems.map(([name, color]) => (
            <div key={name} className="flex items-center gap-1.5 text-sm">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color || '#6366f1' }} />
              <span className="text-muted-foreground">{name}</span>
            </div>
          ))}
        </div>
      )}

      {viewMode === 'day' ? (
        <div className="grid md:grid-cols-[auto_1fr] gap-6">
          <Card className="shadow-card self-start">
            <CardContent className="p-4">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={d => d && setSelectedDate(d)}
                locale={he}
                className="pointer-events-auto"
                classNames={{
                  months: "flex flex-col",
                  month: "space-y-6",
                  caption: "flex justify-center pt-2 relative items-center",
                  caption_label: "text-base font-semibold",
                  nav_button: cn("h-9 w-9 bg-transparent p-0 opacity-50 hover:opacity-100 inline-flex items-center justify-center rounded-md border border-input"),
                  nav_button_previous: "absolute left-2",
                  nav_button_next: "absolute right-2",
                  table: "w-full border-collapse",
                  head_row: "flex",
                  head_cell: "text-muted-foreground rounded-md w-10 md:w-14 h-8 md:h-10 font-medium text-xs md:text-sm flex items-center justify-center",
                  row: "flex w-full mt-1",
                  cell: "h-10 w-10 md:h-14 md:w-14 text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                  day: "h-10 w-10 md:h-14 md:w-14 p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground inline-flex items-center justify-center rounded-md text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                  day_today: "bg-accent text-accent-foreground",
                  day_outside: "text-muted-foreground opacity-50",
                  day_disabled: "text-muted-foreground opacity-50",
                  day_hidden: "invisible",
                }}
                components={{
                  DayContent: ({ date }) => (
                    <div className="flex flex-col items-center leading-tight">
                      <span className="text-sm font-medium">{date.getDate()}</span>
                      <span className="text-[10px] text-muted-foreground">{getHebrewDateShort(date)}</span>
                    </div>
                  ),
                }}
              />
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {format(selectedDate, 'EEEE, d בMMMM yyyy', { locale: he })}
              </h2>
              <p className="text-sm text-muted-foreground">{getHebrewDate(selectedDate)}</p>
            </div>

            {appointments.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">אין תורים ליום זה</p>
            ) : (
              <div className="space-y-3">
                {appointments.map(apt => (
                  <AppointmentCard key={apt.id} apt={apt} onStatusChange={updateStatus} />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Weekly View */
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            <div className="grid grid-cols-8 border border-border rounded-lg overflow-hidden">
              {/* Header row */}
              <div className="bg-muted p-2 text-center text-sm font-medium border-b border-border">שעה</div>
              {weekDays.map(day => (
                <div key={day.toISOString()} className={cn(
                  "bg-muted p-2 text-center text-sm border-b border-border cursor-pointer hover:bg-accent",
                  format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') && "bg-primary/10"
                )} onClick={() => { setSelectedDate(day); setViewMode('day'); }}>
                  <div className="font-medium">{format(day, 'EEE', { locale: he })}</div>
                  <div className="text-xs text-muted-foreground">{format(day, 'd/M')}</div>
                </div>
              ))}

              {/* Hour rows */}
              {hours.map(hour => (
                <>
                  <div key={`h-${hour}`} className="p-2 text-xs text-muted-foreground border-b border-border text-center">
                    {String(hour).padStart(2, '0')}:00
                  </div>
                  {weekDays.map(day => {
                    const dayStr = format(day, 'yyyy-MM-dd');
                    const dayApts = weekAppointments.filter(a =>
                      a.appointment_date === dayStr &&
                      parseInt(a.start_time.substring(0, 2)) === hour
                    );
                    return (
                      <div key={`${dayStr}-${hour}`} className="border-b border-l border-border p-1 min-h-[40px] relative">
                        {dayApts.map(apt => (
                          <div
                            key={apt.id}
                            className="text-[10px] p-1 rounded mb-0.5 text-white truncate cursor-pointer"
                            style={{ backgroundColor: apt.treatments?.color || '#6366f1' }}
                            title={`${apt.profiles?.full_name || 'לקוחה'} - ${apt.treatments?.name}`}
                            onClick={() => { setSelectedDate(day); setViewMode('day'); }}
                          >
                            {apt.start_time.substring(0, 5)} {apt.treatments?.name}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Admin Book Dialog */}
      <Dialog open={showBookDialog} onOpenChange={setShowBookDialog}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>קביעת תור (אדמין)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>לקוחה</Label>
              <Select value={bookForm.client_id} onValueChange={v => setBookForm(prev => ({ ...prev, client_id: v }))}>
                <SelectTrigger><SelectValue placeholder="בחרי לקוחה" /></SelectTrigger>
                <SelectContent>
                  {profiles.map(p => (
                    <SelectItem key={p.user_id} value={p.user_id}>{p.full_name} {p.phone && `(${p.phone})`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>טיפול</Label>
              <Select value={bookForm.treatment_id} onValueChange={onTreatmentSelect}>
                <SelectTrigger><SelectValue placeholder="בחרי טיפול" /></SelectTrigger>
                <SelectContent>
                  {treatments.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name} ({t.duration_minutes} דק׳)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>תאריך</Label>
              <Input type="date" value={bookForm.date} onChange={e => setBookForm(prev => ({ ...prev, date: e.target.value }))} dir="ltr" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>שעת התחלה</Label>
                <Input type="time" value={bookForm.start_time} onChange={e => {
                  const val = e.target.value;
                  setBookForm(prev => ({ ...prev, start_time: val }));
                  const t = treatments.find(tr => tr.id === bookForm.treatment_id);
                  if (t) {
                    const [h, m] = val.split(':').map(Number);
                    const endMin = h * 60 + m + t.duration_minutes;
                    setBookForm(prev => ({
                      ...prev, start_time: val,
                      end_time: `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`
                    }));
                  }
                }} dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>שעת סיום</Label>
                <Input type="time" value={bookForm.end_time} onChange={e => setBookForm(prev => ({ ...prev, end_time: e.target.value }))} dir="ltr" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">⚠️ תור אדמין מאפשר חפיפה עם תורים קיימים</p>
            <Button className="w-full gradient-primary text-primary-foreground" onClick={handleAdminBook}>קביעת תור</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AppointmentCard({ apt, onStatusChange }: { apt: Appointment; onStatusChange: (id: string, status: string) => void }) {
  const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    confirmed: { label: 'מאושר', variant: 'default' },
    completed: { label: 'הושלם', variant: 'secondary' },
    cancelled: { label: 'בוטל', variant: 'destructive' },
    no_show: { label: 'לא הגיע/ה', variant: 'outline' },
  };
  const s = statusMap[apt.status] || statusMap.confirmed;

  return (
    <Card className="shadow-card overflow-hidden">
      <div className="flex">
        <div className="w-1.5 flex-shrink-0" style={{ backgroundColor: apt.treatments?.color || '#6366f1' }} />
        <CardContent className="p-4 flex-1">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-medium text-primary">
                  {apt.start_time.substring(0, 5)} - {apt.end_time.substring(0, 5)}
                </span>
                <Badge variant={s.variant}>{s.label}</Badge>
                {apt.booked_by_admin && <Badge variant="outline" className="text-xs">אדמין</Badge>}
              </div>
              <h3 className="font-medium text-foreground">{apt.treatments?.name}</h3>
              <p className="text-sm text-muted-foreground">
                {apt.profiles?.full_name || 'לקוחה'} {apt.profiles?.phone && `• ${apt.profiles.phone}`}
              </p>
              {/* Communication buttons */}
              {apt.profiles && (
                <div className="flex items-center gap-1 mt-2">
                  {apt.profiles.phone && (
                    <>
                      <a href={`tel:${apt.profiles.phone}`}>
                        <Button variant="ghost" size="icon" className="h-7 w-7"><Phone className="h-3.5 w-3.5" /></Button>
                      </a>
                      <a href={`sms:${apt.profiles.phone}`}>
                        <Button variant="ghost" size="icon" className="h-7 w-7"><MessageSquare className="h-3.5 w-3.5" /></Button>
                      </a>
                      <a href={`https://wa.me/${apt.profiles.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" className="h-7 w-7"><MessageCircle className="h-3.5 w-3.5" /></Button>
                      </a>
                    </>
                  )}
                </div>
              )}
            </div>
            <Select value={apt.status} onValueChange={v => onStatusChange(apt.id, v)}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="confirmed">מאושר</SelectItem>
                <SelectItem value="completed">הושלם</SelectItem>
                <SelectItem value="cancelled">בוטל</SelectItem>
                <SelectItem value="no_show">לא הגיע/ה</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}
