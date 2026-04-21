import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, startOfDay } from 'date-fns';
import { he } from 'date-fns/locale';
import { getHebrewDateShort } from '@/lib/hebrew-date';
import { CalendarDays, Users, Sparkles, TrendingUp } from 'lucide-react';

interface ClientProfile {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  created_at: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState({ todayCount: 0, totalClients: 0, totalTreatments: 0, weekCount: 0 });
  const [clients, setClients] = useState<ClientProfile[]>([]);

  useEffect(() => {
    fetchStats();
    fetchClients();
  }, []);

  const fetchStats = async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const weekFromNow = format(new Date(Date.now() + 7 * 86400000), 'yyyy-MM-dd');

    const [todayRes, weekRes, treatmentsRes, clientsRes] = await Promise.all([
      supabase.from('appointments').select('id', { count: 'exact' }).eq('appointment_date', today).eq('status', 'confirmed'),
      supabase.from('appointments').select('id', { count: 'exact' }).gte('appointment_date', today).lte('appointment_date', weekFromNow).eq('status', 'confirmed'),
      supabase.from('treatments').select('id', { count: 'exact' }).eq('is_active', true),
      supabase.from('profiles').select('id', { count: 'exact' }),
    ]);

    setStats({
      todayCount: todayRes.count ?? 0,
      weekCount: weekRes.count ?? 0,
      totalTreatments: treatmentsRes.count ?? 0,
      totalClients: clientsRes.count ?? 0,
    });
  };

  const fetchClients = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, user_id, full_name, phone, email, created_at')
      .order('created_at', { ascending: false });
    if (data) setClients(data);
  };

  const today = new Date();

  const statCards = [
    { label: 'תורים היום', value: stats.todayCount, icon: CalendarDays, color: 'text-primary' },
    { label: 'תורים השבוע', value: stats.weekCount, icon: TrendingUp, color: 'text-primary' },
    { label: 'טיפולים פעילים', value: stats.totalTreatments, icon: Sparkles, color: 'text-primary' },
    { label: 'לקוחות', value: stats.totalClients, icon: Users, color: 'text-primary' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">לוח בקרה</h1>
        <p className="text-muted-foreground mt-1">
          {format(today, 'EEEE, d בMMMM yyyy', { locale: he })} • {getHebrewDateShort(today)}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            כל הלקוחות
          </CardTitle>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">אין לקוחות עדיין</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">שם</TableHead>
                    <TableHead className="text-right">טלפון</TableHead>
                    <TableHead className="text-right">אימייל</TableHead>
                    <TableHead className="text-right">תאריך הצטרפות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map(client => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.full_name || '—'}</TableCell>
                      <TableCell dir="ltr" className="text-right">{client.phone || '—'}</TableCell>
                      <TableCell>{client.email || '—'}</TableCell>
                      <TableCell>{format(new Date(client.created_at), 'd/M/yyyy')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
