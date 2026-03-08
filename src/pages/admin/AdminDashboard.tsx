import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, startOfDay } from 'date-fns';
import { he } from 'date-fns/locale';
import { getHebrewDateShort } from '@/lib/hebrew-date';
import { CalendarDays, Users, Sparkles, TrendingUp } from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ todayCount: 0, totalClients: 0, totalTreatments: 0, weekCount: 0 });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const weekFromNow = format(new Date(Date.now() + 7 * 86400000), 'yyyy-MM-dd');

    const [todayRes, weekRes, treatmentsRes] = await Promise.all([
      supabase.from('appointments').select('id', { count: 'exact' }).eq('appointment_date', today).eq('status', 'confirmed'),
      supabase.from('appointments').select('id', { count: 'exact' }).gte('appointment_date', today).lte('appointment_date', weekFromNow).eq('status', 'confirmed'),
      supabase.from('treatments').select('id', { count: 'exact' }).eq('is_active', true),
    ]);

    setStats({
      todayCount: todayRes.count ?? 0,
      weekCount: weekRes.count ?? 0,
      totalTreatments: treatmentsRes.count ?? 0,
      totalClients: 0,
    });
  };

  const today = new Date();

  const statCards = [
    { label: 'תורים היום', value: stats.todayCount, icon: CalendarDays, color: 'text-primary' },
    { label: 'תורים השבוע', value: stats.weekCount, icon: TrendingUp, color: 'text-primary' },
    { label: 'טיפולים פעילים', value: stats.totalTreatments, icon: Sparkles, color: 'text-primary' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">לוח בקרה</h1>
        <p className="text-muted-foreground mt-1">
          {format(today, 'EEEE, d בMMMM yyyy', { locale: he })} • {getHebrewDateShort(today)}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map(s => (
          <Card key={s.label} className="shadow-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{s.value}</p>
                </div>
                <s.icon className={`h-10 w-10 ${s.color} opacity-30`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
