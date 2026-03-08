import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format, addDays, isBefore, startOfDay } from 'date-fns';
import { he } from 'date-fns/locale';
import { getHebrewDateShort } from '@/lib/hebrew-date';
import { Clock, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Treatment {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  category: string;
}

interface BusinessSettings {
  working_days: number[];
  start_time: string;
  end_time: string;
  break_start: string | null;
  break_end: string | null;
  slot_duration_minutes: number;
  advance_booking_days: number;
  business_name: string;
}

export default function ClientBooking() {
  const { user } = useAuth();
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [selectedTreatment, setSelectedTreatment] = useState<Treatment | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [bookedSlots, setBookedSlots] = useState<{ start_time: string; end_time: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'treatment' | 'date' | 'time'>('treatment');
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  useEffect(() => {
    fetchTreatments();
    fetchSettings();
  }, []);

  useEffect(() => {
    if (selectedDate) fetchBookedSlots(selectedDate);
  }, [selectedDate]);

  const fetchTreatments = async () => {
    const { data } = await supabase.from('treatments').select('*').eq('is_active', true);
    if (data) setTreatments(data as Treatment[]);
  };

  const fetchSettings = async () => {
    const { data } = await supabase.from('business_settings').select('*').limit(1).single();
    if (data) setSettings(data as unknown as BusinessSettings);
  };

  const fetchBookedSlots = async (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const { data } = await supabase
      .from('appointments')
      .select('start_time, end_time')
      .eq('appointment_date', dateStr)
      .eq('status', 'confirmed');
    if (data) setBookedSlots(data);
  };

  const availableSlots = useMemo(() => {
    if (!settings || !selectedDate || !selectedTreatment) return [];

    const slots: string[] = [];
    const [startH, startM] = settings.start_time.split(':').map(Number);
    const [endH, endM] = settings.end_time.split(':').map(Number);
    const breakStart = settings.break_start ? settings.break_start.split(':').map(Number) : null;
    const breakEnd = settings.break_end ? settings.break_end.split(':').map(Number) : null;

    let current = startH * 60 + startM;
    const end = endH * 60 + endM;
    const duration = selectedTreatment.duration_minutes;

    while (current + duration <= end) {
      const h = Math.floor(current / 60);
      const m = current % 60;
      const slotStart = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const slotEndMin = current + duration;
      const slotEndH = Math.floor(slotEndMin / 60);
      const slotEndM = slotEndMin % 60;
      const slotEnd = `${String(slotEndH).padStart(2, '0')}:${String(slotEndM).padStart(2, '0')}`;

      // Check break overlap
      let inBreak = false;
      if (breakStart && breakEnd) {
        const bStart = breakStart[0] * 60 + breakStart[1];
        const bEnd = breakEnd[0] * 60 + breakEnd[1];
        if (current < bEnd && slotEndMin > bStart) inBreak = true;
      }

      // Check if already booked
      const isBooked = bookedSlots.some(b => {
        const bStart = b.start_time.substring(0, 5);
        const bEnd = b.end_time.substring(0, 5);
        return slotStart < bEnd && slotEnd > bStart;
      });

      if (!inBreak && !isBooked) {
        slots.push(slotStart);
      }

      current += settings.slot_duration_minutes;
    }

    return slots;
  }, [settings, selectedDate, selectedTreatment, bookedSlots]);

  const isWorkingDay = (date: Date) => {
    if (!settings) return false;
    return settings.working_days.includes(date.getDay());
  };

  const handleBook = async () => {
    if (!user || !selectedTreatment || !selectedDate || !selectedTime) return;
    setLoading(true);

    const duration = selectedTreatment.duration_minutes;
    const [h, m] = selectedTime.split(':').map(Number);
    const endMin = h * 60 + m + duration;
    const endTime = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;

    try {
      const { error } = await supabase.from('appointments').insert({
        client_id: user.id,
        treatment_id: selectedTreatment.id,
        appointment_date: format(selectedDate, 'yyyy-MM-dd'),
        start_time: selectedTime,
        end_time: endTime,
      });

      if (error) {
        if (error.message.includes('already booked')) {
          toast.error('השעה כבר תפוסה, נסי שעה אחרת');
        } else {
          toast.error('שגיאה בהזמנת התור');
        }
      } else {
        toast.success('התור נקבע בהצלחה! 🎉');
        setStep('treatment');
        setSelectedTreatment(null);
        setSelectedDate(undefined);
        setSelectedTime(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const HebrewDateLabel = ({ date }: { date: Date }) => (
    <span className="text-[10px] text-muted-foreground block">{getHebrewDateShort(date)}</span>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="text-center">
        <h1 className="text-2xl font-display font-bold text-foreground">
          {settings?.business_name || 'קביעת תור'}
        </h1>
        <p className="text-muted-foreground mt-1">בחרי טיפול, תאריך ושעה</p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center justify-center gap-2">
        {['טיפול', 'תאריך', 'שעה'].map((label, i) => {
          const stepNames = ['treatment', 'date', 'time'] as const;
          const isActive = step === stepNames[i];
          const isDone = stepNames.indexOf(step) > i;
          return (
            <div key={label} className="flex items-center gap-2">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                isActive ? "gradient-primary text-primary-foreground" :
                isDone ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
              )}>
                {i + 1}
              </div>
              <span className={cn("text-sm hidden sm:inline", isActive ? "text-foreground font-medium" : "text-muted-foreground")}>{label}</span>
              {i < 2 && <ChevronLeft className="h-4 w-4 text-muted-foreground" />}
            </div>
          );
        })}
      </div>

      {/* Step 1: Treatment */}
      {step === 'treatment' && (
        <div className="grid gap-3">
          {treatments.map(t => (
            <Card
              key={t.id}
              className={cn(
                "cursor-pointer transition-all hover:shadow-elegant",
                selectedTreatment?.id === t.id && "ring-2 ring-primary"
              )}
              onClick={() => {
                setSelectedTreatment(t);
                setStep('date');
              }}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <h3 className="font-medium text-foreground">{t.name}</h3>
                  <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{t.duration_minutes} דק׳</span>
                    {t.category && <Badge variant="secondary" className="text-xs">{t.category}</Badge>}
                  </div>
                </div>
                <span className="text-lg font-semibold text-primary">₪{t.price}</span>
              </CardContent>
            </Card>
          ))}
          {treatments.length === 0 && (
            <p className="text-center text-muted-foreground py-8">אין טיפולים זמינים כרגע</p>
          )}
        </div>
      )}

      {/* Step 2: Date */}
      {step === 'date' && (
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">בחרי תאריך</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setStep('treatment')}>חזרה</Button>
            </div>
            {selectedTreatment && (
              <p className="text-sm text-muted-foreground">{selectedTreatment.name} • {selectedTreatment.duration_minutes} דק׳</p>
            )}
          </CardHeader>
          <CardContent className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                setSelectedDate(date);
                if (date) setStep('time');
              }}
              disabled={(date) =>
                isBefore(date, startOfDay(new Date())) ||
                !isWorkingDay(date) ||
                isBefore(addDays(new Date(), settings?.advance_booking_days ?? 30), date)
              }
              locale={he}
              className="p-3 pointer-events-auto"
              components={{
                DayContent: ({ date }) => (
                  <div className="flex flex-col items-center">
                    <span>{date.getDate()}</span>
                    <HebrewDateLabel date={date} />
                  </div>
                ),
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Step 3: Time */}
      {step === 'time' && selectedDate && (
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">בחרי שעה</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {format(selectedDate, 'EEEE, d בMMMM yyyy', { locale: he })}
                  {' • '}
                  {getHebrewDateShort(selectedDate)}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setStep('date')}>חזרה</Button>
            </div>
          </CardHeader>
          <CardContent>
            {availableSlots.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">אין שעות פנויות בתאריך זה</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {availableSlots.map(slot => (
                  <Button
                    key={slot}
                    variant={selectedTime === slot ? 'default' : 'outline'}
                    className={cn(selectedTime === slot && "gradient-primary text-primary-foreground")}
                    onClick={() => setSelectedTime(slot)}
                  >
                    {slot}
                  </Button>
                ))}
              </div>
            )}

            {selectedTime && (
              <div className="mt-6 p-4 rounded-lg bg-secondary/50 space-y-2">
                <h4 className="font-medium text-foreground">סיכום הזמנה</h4>
                <p className="text-sm text-muted-foreground">טיפול: {selectedTreatment?.name}</p>
                <p className="text-sm text-muted-foreground">
                  תאריך: {format(selectedDate, 'd/M/yyyy')} • {getHebrewDateShort(selectedDate)}
                </p>
                <p className="text-sm text-muted-foreground">שעה: {selectedTime}</p>
                <p className="text-sm font-medium text-primary">מחיר: ₪{selectedTreatment?.price}</p>
                <Button
                  className="w-full mt-3 gradient-primary text-primary-foreground"
                  onClick={handleBook}
                  disabled={loading}
                >
                  {loading ? 'מזמין...' : 'אישור הזמנה'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
