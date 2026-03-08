import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, parseISO } from 'date-fns';
import { he } from 'date-fns/locale';
import { getHebrewDateShort, getHebrewDate } from '@/lib/hebrew-date';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Appointment {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  profiles: { full_name: string; phone: string } | null;
  treatments: { name: string } | null;
}

export default function AdminCalendar() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  useEffect(() => {
    fetchAppointments();
  }, [selectedDate]);

  const fetchAppointments = async () => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const { data } = await supabase
      .from('appointments')
      .select('*, treatments(name)')
      .eq('appointment_date', dateStr)
      .order('start_time');
    
    // Fetch client profiles separately
    if (data && data.length > 0) {
      const clientIds = [...new Set(data.map(a => a.client_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, phone')
        .in('user_id', clientIds);
      
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      const enriched = data.map(a => ({
        ...a,
        profiles: profileMap.get(a.client_id) || null,
      }));
      setAppointments(enriched as unknown as Appointment[]);
      return;
    }
    if (data) setAppointments(data as unknown as Appointment[]);
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('appointments').update({ status }).eq('id', id);
    if (error) toast.error('שגיאה בעדכון');
    else { toast.success('הסטטוס עודכן'); fetchAppointments(); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-display font-bold text-foreground">יומן תורים</h1>

      <div className="grid md:grid-cols-[auto_1fr] gap-6">
        <Card className="shadow-card">
          <CardContent className="p-3">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={d => d && setSelectedDate(d)}
              locale={he}
              className="pointer-events-auto"
              components={{
                DayContent: ({ date }) => (
                  <div className="flex flex-col items-center">
                    <span>{date.getDate()}</span>
                    <span className="text-[9px] text-muted-foreground">{getHebrewDateShort(date)}</span>
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
                <Card key={apt.id} className="shadow-card">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-medium text-primary">
                            {apt.start_time.substring(0, 5)} - {apt.end_time.substring(0, 5)}
                          </span>
                          <StatusBadge status={apt.status} />
                        </div>
                        <h3 className="font-medium text-foreground">{apt.treatments?.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {apt.profiles?.full_name || 'לקוחה'} {apt.profiles?.phone && `• ${apt.profiles.phone}`}
                        </p>
                      </div>
                      <Select value={apt.status} onValueChange={v => updateStatus(apt.id, v)}>
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
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    confirmed: { label: 'מאושר', variant: 'default' },
    completed: { label: 'הושלם', variant: 'secondary' },
    cancelled: { label: 'בוטל', variant: 'destructive' },
    no_show: { label: 'לא הגיע/ה', variant: 'outline' },
  };
  const s = map[status] || map.confirmed;
  return <Badge variant={s.variant}>{s.label}</Badge>;
}
