import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { format, parseISO, isBefore, startOfDay } from 'date-fns';
import { he } from 'date-fns/locale';
import { getHebrewDateShort } from '@/lib/hebrew-date';
import { Calendar, Clock, X } from 'lucide-react';

interface Appointment {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  treatments: { name: string; duration_minutes: number; price: number } | null;
}

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  confirmed: { label: 'מאושר', variant: 'default' },
  completed: { label: 'הושלם', variant: 'secondary' },
  cancelled: { label: 'בוטל', variant: 'destructive' },
  no_show: { label: 'לא הגיע/ה', variant: 'outline' },
};

export default function MyAppointments() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchAppointments();
  }, [user]);

  const fetchAppointments = async () => {
    const { data } = await supabase
      .from('appointments')
      .select('*, treatments(name, duration_minutes, price)')
      .eq('client_id', user!.id)
      .order('appointment_date', { ascending: false });
    if (data) setAppointments(data as unknown as Appointment[]);
    setLoading(false);
  };

  const handleCancel = async (id: string) => {
    const { error } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', id);
    if (error) {
      toast.error('שגיאה בביטול');
    } else {
      toast.success('התור בוטל');
      fetchAppointments();
    }
  };

  const upcoming = appointments.filter(a => a.status === 'confirmed' && !isBefore(parseISO(a.appointment_date), startOfDay(new Date())));
  const past = appointments.filter(a => a.status !== 'confirmed' || isBefore(parseISO(a.appointment_date), startOfDay(new Date())));

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <h1 className="text-2xl font-display font-bold text-foreground">התורים שלי</h1>

      {loading ? (
        <p className="text-muted-foreground text-center py-8">טוען...</p>
      ) : (
        <>
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">תורים קרובים</h2>
            {upcoming.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">אין תורים קרובים</p>
            ) : (
              <div className="space-y-3">
                {upcoming.map(apt => (
                  <AppointmentCard key={apt.id} appointment={apt} onCancel={handleCancel} canCancel />
                ))}
              </div>
            )}
          </section>

          {past.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">היסטוריה</h2>
              <div className="space-y-3">
                {past.map(apt => (
                  <AppointmentCard key={apt.id} appointment={apt} onCancel={handleCancel} canCancel={false} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function AppointmentCard({ appointment: apt, onCancel, canCancel }: {
  appointment: Appointment;
  onCancel: (id: string) => void;
  canCancel: boolean;
}) {
  const date = parseISO(apt.appointment_date);
  const status = STATUS_MAP[apt.status] || STATUS_MAP.confirmed;

  return (
    <Card className="shadow-card">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="font-medium text-foreground">{apt.treatments?.name}</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>{format(date, 'd/M/yyyy')} • {getHebrewDateShort(date)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>{apt.start_time.substring(0, 5)} - {apt.end_time.substring(0, 5)}</span>
            </div>
            <Badge variant={status.variant} className="mt-1">{status.label}</Badge>
          </div>
          {canCancel && apt.status === 'confirmed' && (
            <Button variant="ghost" size="sm" onClick={() => onCancel(apt.id)} className="text-destructive hover:text-destructive">
              <X className="h-4 w-4 mr-1" />
              ביטול
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
