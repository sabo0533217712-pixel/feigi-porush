import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { format, parseISO, isBefore, startOfDay, differenceInHours } from 'date-fns';
import { he } from 'date-fns/locale';
import { getHebrewDateShort } from '@/lib/hebrew-date';
import { Calendar, Clock, X, AlertCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Appointment {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  treatments: { name: string; duration_minutes: number; price: number; color: string } | null;
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
  const [cancelId, setCancelId] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchAppointments();
  }, [user]);

  const fetchAppointments = async () => {
    const { data } = await supabase
      .from('appointments')
      .select('*, treatments(name, duration_minutes, price, color)')
      .eq('client_id', user!.id)
      .order('appointment_date', { ascending: false });
    if (data) setAppointments(data as unknown as Appointment[]);
    setLoading(false);
  };

  const canCancel = (apt: Appointment): { allowed: boolean; reason?: string } => {
    if (apt.status !== 'confirmed') return { allowed: false };
    const aptDate = parseISO(apt.appointment_date);
    if (isBefore(aptDate, startOfDay(new Date()))) return { allowed: false };

    // Parse appointment datetime
    const [h, m] = apt.start_time.split(':').map(Number);
    const aptDateTime = new Date(aptDate);
    aptDateTime.setHours(h, m, 0, 0);

    const hoursUntil = differenceInHours(aptDateTime, new Date());
    if (hoursUntil < 24) {
      return { allowed: false, reason: 'ניתן לבטל עד 24 שעות לפני התור' };
    }
    return { allowed: true };
  };

  const confirmCancel = async () => {
    if (!cancelId) return;
    const { error } = await (supabase.rpc as any)('cancel_my_appointment', { _appointment_id: cancelId });
    if (error) {
      const msg = error.message || '';
      if (msg.includes('Cancellation window')) {
        toast.error('חלון הביטול נסגר (פחות מ-24 שעות לפני התור)');
      } else {
        toast.error('שגיאה בביטול');
      }
    } else {
      toast.success('התור בוטל');
      fetchAppointments();
    }
    setCancelId(null);
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
                {upcoming.map(apt => {
                  const cancelStatus = canCancel(apt);
                  return (
                    <AppointmentCard
                      key={apt.id}
                      appointment={apt}
                      onCancel={handleCancel}
                      cancelStatus={cancelStatus}
                    />
                  );
                })}
              </div>
            )}
          </section>

          {past.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">היסטוריה</h2>
              <div className="space-y-3">
                {past.map(apt => (
                  <AppointmentCard
                    key={apt.id}
                    appointment={apt}
                    onCancel={handleCancel}
                    cancelStatus={{ allowed: false }}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function AppointmentCard({ appointment: apt, onCancel, cancelStatus }: {
  appointment: Appointment;
  onCancel: (id: string) => void;
  cancelStatus: { allowed: boolean; reason?: string };
}) {
  const date = parseISO(apt.appointment_date);
  const status = STATUS_MAP[apt.status] || STATUS_MAP.confirmed;

  return (
    <Card className="shadow-card overflow-hidden">
      <div className="flex">
        <div className="w-1.5 flex-shrink-0" style={{ backgroundColor: apt.treatments?.color || '#6366f1' }} />
        <CardContent className="p-4 flex-1">
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
              {apt.treatments?.price && (
                <span className="text-sm text-primary font-medium">₪{apt.treatments.price}</span>
              )}
              <Badge variant={status.variant} className="mt-1">{status.label}</Badge>
            </div>
            <div className="flex flex-col items-end gap-1">
              {cancelStatus.allowed && (
                <Button variant="ghost" size="sm" onClick={() => onCancel(apt.id)} className="text-destructive hover:text-destructive">
                  <X className="h-4 w-4 mr-1" />
                  ביטול
                </Button>
              )}
              {cancelStatus.reason && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground max-w-[140px] text-left">
                  <AlertCircle className="h-3 w-3 flex-shrink-0" />
                  <span>{cancelStatus.reason}</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}
