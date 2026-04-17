import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { getHebrewDateShort, getHebrewDate } from "@/lib/hebrew-date";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Phone, Mail, MessageCircle, MessageSquare, Plus, X, Ban, Edit, User, ChevronUp, ListChecks, CalendarIcon, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface WaitlistEntry {
  id: string;
  client_id: string;
  treatment_id: string | null;
  preferred_date: string | null;
  preferred_time_start: string | null;
  preferred_time_end: string | null;
  notes: string | null;
  status: string;
  profiles?: { full_name: string; phone: string; email: string } | null;
  treatments?: { name: string; duration_minutes: number; is_variable_duration: boolean } | null;
}

interface Treatment {
  id: string;
  name: string;
  color: string;
  duration_minutes: number;
  price: number;
  is_variable_duration: boolean;
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
  profiles: { full_name: string; phone: string; email: string; user_id: string } | null;
  treatments: { name: string; color: string } | null;
}

interface Profile {
  user_id: string;
  full_name: string;
  phone: string;
  email: string;
}

interface TimeBlock {
  id: string;
  block_date: string;
  start_time: string;
  end_time: string;
  notes: string;
}

interface DaySchedule {
  start: string;
  end: string;
  breaks: { start: string; end: string }[];
}
type DaySchedules = Record<string, DaySchedule>;

interface BusinessSettings {
  start_time: string;
  end_time: string;
  day_schedules?: DaySchedules;
  working_days: number[];
  break_start?: string | null;
  break_end?: string | null;
}

export default function AdminCalendar() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [monthCounts, setMonthCounts] = useState<Record<string, number>>({});
  const [monthColors, setMonthColors] = useState<Record<string, string[]>>({});
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showMoveDatePicker, setShowMoveDatePicker] = useState(false);
  const [moveMonth, setMoveMonth] = useState<Date>(new Date());
  const [moveMonthCounts, setMoveMonthCounts] = useState<Record<string, number>>({});
  const [moveMonthColors, setMoveMonthColors] = useState<Record<string, string[]>>({});

  // Dialogs
  const [showBookDialog, setShowBookDialog] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showClientInfo, setShowClientInfo] = useState<Appointment | null>(null);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [showWaitlistPicker, setShowWaitlistPicker] = useState(false);
  const [selectedWaitlistId, setSelectedWaitlistId] = useState<string | null>(null);
  const [waitlistContactEntry, setWaitlistContactEntry] = useState<WaitlistEntry | null>(null);

  const [bookForm, setBookForm] = useState({
    client_id: "",
    treatment_id: "",
    start_time: "09:00",
    end_time: "09:30",
    notes: "",
  });
  const [blockForm, setBlockForm] = useState({ start_time: "09:00", end_time: "10:00", notes: "" });
  const [editForm, setEditForm] = useState<{
    id: string;
    start_time: string;
    end_time: string;
    status: string;
    notes: string;
  } | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);

  useEffect(() => {
    fetchTreatments();
    fetchProfiles();
    fetchSettings();
    fetchWaitlist();
  }, []);

  useEffect(() => {
    fetchDayData();
  }, [selectedDate]);

  useEffect(() => {
    fetchMonthCounts();
  }, [currentMonth]);

  // Realtime + fallback refresh for the currently viewed day
  useEffect(() => {
    const selectedDateStr = format(selectedDate, "yyyy-MM-dd");

    const refreshDay = () => {
      fetchDayData();
    };

    const refreshAll = () => {
      fetchDayData();
      fetchMonthCounts();
    };

    const channel = supabase
      .channel(`admin-appointments-realtime-${selectedDateStr}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `appointment_date=eq.${selectedDateStr}`,
        },
        refreshAll,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "time_blocks",
          filter: `block_date=eq.${selectedDateStr}`,
        },
        refreshDay,
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          refreshAll();
        }
      });

    const fallbackInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        refreshDay();
      }
    }, 2000);

    const handleFocus = () => refreshAll();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshAll();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(fallbackInterval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, currentMonth]);

  const fetchMonthCounts = async () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = format(new Date(year, month, 1), "yyyy-MM-dd");
    const lastDay = format(new Date(year, month + 1, 0), "yyyy-MM-dd");
    const { data } = await supabase
      .from("appointments")
      .select("appointment_date, treatments(color)")
      .gte("appointment_date", firstDay)
      .lte("appointment_date", lastDay)
      .neq("status", "cancelled");
    if (data) {
      const counts: Record<string, number> = {};
      const colors: Record<string, string[]> = {};
      data.forEach((a: any) => {
        counts[a.appointment_date] = (counts[a.appointment_date] || 0) + 1;
        const c = a.treatments?.color || "hsl(var(--primary))";
        if (!colors[a.appointment_date]) colors[a.appointment_date] = [];
        colors[a.appointment_date].push(c);
      });
      setMonthCounts(counts);
      setMonthColors(colors);
    }
  };

  const fetchSettings = async () => {
    const { data } = await supabase
      .from("business_settings")
      .select("start_time, end_time, day_schedules, working_days, break_start, break_end")
      .limit(1)
      .single();
    if (data) setSettings(data as unknown as BusinessSettings);
  };

  const fetchTreatments = async () => {
    const { data } = await supabase
      .from("treatments")
      .select("id, name, color, duration_minutes, price, is_variable_duration")
      .eq("is_active", true);
    if (data) setTreatments(data as Treatment[]);
  };

  const fetchProfiles = async () => {
    const { data } = await supabase.from("profiles").select("user_id, full_name, phone, email");
    if (data) setProfiles(data);
  };

  const fetchWaitlist = async () => {
    const { data } = await supabase
      .from("waitlist")
      .select("*")
      .eq("status", "waiting");
    if (data && data.length > 0) {
      const clientIds = [...new Set(data.map((w) => w.client_id))];
      const treatmentIds = [...new Set(data.filter((w) => w.treatment_id).map((w) => w.treatment_id!))];
      const [profsRes, treatsRes] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, phone, email").in("user_id", clientIds),
        treatmentIds.length > 0
          ? supabase.from("treatments").select("id, name, duration_minutes, is_variable_duration").in("id", treatmentIds)
          : Promise.resolve({ data: [] }),
      ]);
      const profMap = new Map<string, any>(profsRes.data?.map((p) => [p.user_id, p] as const) || []);
      const treatMap = new Map<string, any>(treatsRes.data?.map((t: any) => [t.id, t] as const) || []);
      setWaitlist(
        data.map((w) => ({
          ...w,
          profiles: profMap.get(w.client_id) || null,
          treatments: w.treatment_id ? (treatMap.get(w.treatment_id) as WaitlistEntry['treatments']) || null : null,
        })) as WaitlistEntry[]
      );
    } else {
      setWaitlist([]);
    }
  };

  const fetchDayData = async () => {
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const [aptsRes, blocksRes] = await Promise.all([
      supabase
        .from("appointments")
        .select("*, treatments(name, color)")
        .eq("appointment_date", dateStr)
        .order("start_time"),
      supabase.from("time_blocks").select("*").eq("block_date", dateStr).order("start_time"),
    ]);

    if (aptsRes.data && aptsRes.data.length > 0) {
      const clientIds = [...new Set(aptsRes.data.map((a) => a.client_id))];
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone, email")
        .in("user_id", clientIds);
      const profileMap = new Map(profs?.map((p) => [p.user_id, p]) || []);
      setAppointments(
        aptsRes.data.map((a) => ({ ...a, profiles: profileMap.get(a.client_id) || null })) as unknown as Appointment[],
      );
    } else {
      setAppointments([]);
    }

    setTimeBlocks((blocksRes.data || []) as unknown as TimeBlock[]);
  };

  // Get day hours from settings
  const daySchedule = useMemo(() => {
    if (!settings) return { startHour: 8, endHour: 20, breaks: [] as { start: string; end: string }[] };
    const dow = selectedDate.getDay();
    const ds = settings.day_schedules?.[String(dow)];
    const startTime = ds?.start || settings.start_time;
    const endTime = ds?.end || settings.end_time;
    let breaks = ds?.breaks || [];
    // Fallback to global break_start/break_end if no day-specific breaks
    if (breaks.length === 0 && settings.break_start && settings.break_end) {
      breaks = [{ start: settings.break_start.substring(0, 5), end: settings.break_end.substring(0, 5) }];
    }
    return {
      startHour: parseInt(startTime.split(":")[0]),
      endHour: parseInt(endTime.split(":")[0]) + (parseInt(endTime.split(":")[1]) > 0 ? 1 : 0),
      breaks,
    };
  }, [settings, selectedDate]);

  const timelineHours = useMemo(() => {
    const hours: string[] = [];
    for (let h = daySchedule.startHour; h <= daySchedule.endHour; h++) {
      hours.push(`${String(h).padStart(2, "0")}:00`);
    }
    return hours;
  }, [daySchedule]);

  const HOUR_HEIGHT = 120; // px per hour
  const totalTimelineMinutes = (daySchedule.endHour - daySchedule.startHour) * 60;

  const getTopOffset = (time: string) => {
    const [h, m] = time.substring(0, 5).split(":").map(Number);
    const minutes = (h - daySchedule.startHour) * 60 + m;
    return (minutes / 60) * HOUR_HEIGHT;
  };

  const getHeight = (startTime: string, endTime: string) => {
    const [sh, sm] = startTime.substring(0, 5).split(":").map(Number);
    const [eh, em] = endTime.substring(0, 5).split(":").map(Number);
    const duration = eh * 60 + em - (sh * 60 + sm);
    return Math.max((duration / 60) * HOUR_HEIGHT, 24);
  };

  // Admin book
  const handleAdminBook = async () => {
    if (!bookForm.client_id || !bookForm.treatment_id) {
      toast.error("נא לבחור לקוחה וטיפול");
      return;
    }
    const { error } = await supabase.from("appointments").insert({
      client_id: bookForm.client_id,
      treatment_id: bookForm.treatment_id,
      appointment_date: format(selectedDate, "yyyy-MM-dd"),
      start_time: bookForm.start_time,
      end_time: bookForm.end_time,
      notes: bookForm.notes || null,
      booked_by_admin: true,
    });
    if (error) toast.error("שגיאה בקביעת תור");
    else {
      toast.success("התור נקבע בהצלחה");
      if (selectedWaitlistId) {
        await supabase.from("waitlist").update({ status: "booked" }).eq("id", selectedWaitlistId);
        setSelectedWaitlistId(null);
        fetchWaitlist();
      }
      setShowBookDialog(false);
      setBookForm({ client_id: "", treatment_id: "", start_time: "09:00", end_time: "09:30", notes: "" });
      fetchDayData();
      fetchMonthCounts();
    }
  };

  // Add time block
  const handleAddBlock = async () => {
    const { error } = await supabase.from("time_blocks").insert({
      block_date: format(selectedDate, "yyyy-MM-dd"),
      start_time: blockForm.start_time,
      end_time: blockForm.end_time,
      notes: blockForm.notes,
    });
    if (error) toast.error("שגיאה בחסימת זמן");
    else {
      toast.success("הזמן נחסם");
      setShowBlockDialog(false);
      setBlockForm({ start_time: "09:00", end_time: "10:00", notes: "" });
      fetchDayData();
    }
  };

  // Delete time block
  const handleDeleteBlock = async (id: string) => {
    const { error } = await supabase.from("time_blocks").delete().eq("id", id);
    if (error) toast.error("שגיאה במחיקה");
    else {
      toast.success("החסימה הוסרה");
      fetchDayData();
    }
  };

  // Edit appointment
  const handleEditSave = async () => {
    if (!editForm) return;
    const { error } = await supabase
      .from("appointments")
      .update({
        start_time: editForm.start_time,
        end_time: editForm.end_time,
        status: editForm.status,
        notes: editForm.notes || null,
      })
      .eq("id", editForm.id);
    if (error) toast.error("שגיאה בעדכון");
    else {
      toast.success("התור עודכן");
      setShowEditDialog(false);
      setEditForm(null);
      fetchDayData();
      fetchMonthCounts();
    }
  };

  // Cancel appointment (admin)
  const handleAdminCancel = async () => {
    if (!editingAppointment) return;
    const { error } = await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", editingAppointment.id);
    if (error) {
      toast.error("שגיאה בביטול התור");
    } else {
      toast.success("התור בוטל");
      setShowCancelConfirm(false);
      setShowEditDialog(false);
      setEditingAppointment(null);
      setEditForm(null);
      fetchDayData();
      fetchMonthCounts();
    }
  };

  // Move appointment to a different date
  const handleMoveDate = async (newDate: Date | undefined) => {
    if (!newDate || !editingAppointment) return;
    const newDateStr = format(newDate, "yyyy-MM-dd");
    const { error } = await supabase
      .from("appointments")
      .update({ appointment_date: newDateStr, booked_by_admin: true })
      .eq("id", editingAppointment.id);
    if (error) {
      toast.error("שגיאה בהעברת התור");
    } else {
      toast.success(`התור הועבר ל-${format(newDate, "d בMMMM yyyy", { locale: he })}`);
      setShowMoveDatePicker(false);
      setShowEditDialog(false);
      setEditingAppointment(null);
      setEditForm(null);
      setSelectedDate(newDate);
      fetchMonthCounts();
    }
  };

  const [bookDuration, setBookDuration] = useState<number>(30);

  const onTreatmentSelect = (treatmentId: string) => {
    const t = treatments.find((tr) => tr.id === treatmentId);
    if (t) {
      const dur = t.duration_minutes;
      setBookDuration(dur);
      const [h, m] = bookForm.start_time.split(":").map(Number);
      const endMin = h * 60 + m + dur;
      const endTime = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;
      setBookForm((prev) => ({ ...prev, treatment_id: treatmentId, end_time: endTime }));
    }
  };

  const onBookDurationChange = (newDuration: number) => {
    setBookDuration(newDuration);
    const [h, m] = bookForm.start_time.split(":").map(Number);
    const endMin = h * 60 + m + newDuration;
    const endTime = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;
    setBookForm((prev) => ({ ...prev, end_time: endTime }));
  };

  const selectFromWaitlist = (entry: WaitlistEntry) => {
    setSelectedWaitlistId(entry.id);
    setBookForm((prev) => ({
      ...prev,
      client_id: entry.client_id,
      treatment_id: entry.treatment_id || "",
      notes: entry.notes || "",
    }));
    if (entry.treatment_id) {
      const t = treatments.find((tr) => tr.id === entry.treatment_id);
      if (t) {
        const dur = t.duration_minutes;
        setBookDuration(dur);
        const [h, m] = bookForm.start_time.split(":").map(Number);
        const endMin = h * 60 + m + dur;
        setBookForm((prev) => ({
          ...prev,
          client_id: entry.client_id,
          treatment_id: entry.treatment_id || "",
          notes: entry.notes || "",
          end_time: `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`,
        }));
      }
    }
    if (entry.preferred_time_start) {
      const startTime = entry.preferred_time_start.substring(0, 5);
      const t = treatments.find((tr) => tr.id === entry.treatment_id);
      const dur = t?.is_variable_duration ? bookDuration : t?.duration_minutes || 30;
      const [h, m] = startTime.split(":").map(Number);
      const endMin = h * 60 + m + dur;
      setBookForm((prev) => ({
        ...prev,
        client_id: entry.client_id,
        treatment_id: entry.treatment_id || "",
        notes: entry.notes || "",
        start_time: startTime,
        end_time: `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`,
      }));
    }
    setShowWaitlistPicker(false);
    toast.success(`נבחרה ${entry.profiles?.full_name || "לקוחה"} מרשימת ההמתנה`);
  };

  const handleTimelineClick = (hour: string) => {
    setBookForm((prev) => {
      const t = treatments.find((tr) => tr.id === prev.treatment_id);
      const dur = t?.duration_minutes || 30;
      const [h, m] = hour.split(":").map(Number);
      const endMin = h * 60 + m + dur;
      return {
        ...prev,
        start_time: hour,
        end_time: `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`,
      };
    });
    setShowBookDialog(true);
  };

  const openEditDialog = (apt: Appointment) => {
    setEditingAppointment(apt);
    setEditForm({
      id: apt.id,
      start_time: apt.start_time.substring(0, 5),
      end_time: apt.end_time.substring(0, 5),
      status: apt.status,
      notes: apt.notes || "",
    });
    setShowEditDialog(true);
  };

  const handleDaySelect = (d: Date | undefined) => {
    if (d) {
      setSelectedDate(d);
    }
    // Always open timeline (even if clicking the already-selected day)
    setShowTimeline(true);
  };

  // Legend
  const legendItems = [...new Map(appointments.map((a) => [a.treatments?.name, a.treatments?.color])).entries()].filter(
    ([name]) => name,
  );

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-2xl font-display font-bold text-foreground">יומן תורים</h1>

      {/* Timeline Dialog */}
      <Dialog open={showTimeline} onOpenChange={setShowTimeline}>
        <DialogContent dir="rtl" className="sm:max-w-md max-h-[90vh] overflow-hidden flex flex-col p-4">
          <DialogHeader>
            <DialogTitle className="text-right">
              <div>
                <span>{format(selectedDate, "EEEE, d בMMMM yyyy", { locale: he })}</span>
                <p className="text-sm font-normal text-muted-foreground mt-0.5">{getHebrewDate(selectedDate)}</p>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setBlockForm({ start_time: "09:00", end_time: "10:00", notes: "" });
                setShowBlockDialog(true);
              }}
            >
              <Ban className="h-3.5 w-3.5" /> חסימת זמן
            </Button>
            <Button
              size="sm"
              className="gradient-primary text-primary-foreground gap-1.5"
              onClick={() => {
                setBookForm({ client_id: "", treatment_id: "", start_time: "09:00", end_time: "09:30", notes: "" });
                setShowBookDialog(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" /> תור חדש
            </Button>
          </div>

          {/* Legend */}
          {legendItems.length > 0 && (
            <div className="flex flex-wrap gap-3 mb-3">
              {legendItems.map(([name, color]) => (
                <div key={name} className="flex items-center gap-1.5 text-sm">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color || "hsl(var(--primary))" }} />
                  <span className="text-muted-foreground">{name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Timeline grid */}
          <div className="relative overflow-y-auto flex-1 border border-border rounded-lg" dir="rtl">
            <div className="relative" style={{ height: timelineHours.length * HOUR_HEIGHT }}>
              {/* Hour lines */}
              {timelineHours.map((hour, i) => (
                <div
                  key={hour}
                  className="absolute w-full flex border-b border-border/50 cursor-pointer hover:bg-accent/30 transition-colors"
                  style={{ top: i * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                  onClick={() => handleTimelineClick(hour)}
                >
                  <div
                    className="w-16 flex-shrink-0 text-xs text-muted-foreground p-2 border-l border-border/50 font-mono"
                    dir="ltr"
                  >
                    {hour}
                  </div>
                  <div className="flex-1" />
                </div>
              ))}

              {/* Break zones */}
              {daySchedule.breaks.map((brk, i) => (
                <div
                  key={`brk-${i}`}
                  className="absolute left-0 right-16 pointer-events-none z-[1]"
                  style={{
                    top: getTopOffset(brk.start),
                    height: getHeight(brk.start, brk.end),
                    backgroundImage:
                      "repeating-linear-gradient(45deg, transparent 0, transparent 5px, hsl(var(--muted-foreground) / 0.25) 5px, hsl(var(--muted-foreground) / 0.25) 7px)",
                  }}
                >
                  <span className="text-[10px] font-medium text-muted-foreground bg-background/80 rounded px-1.5 py-0.5 mr-2 mt-1 inline-block">הפסקה</span>
                </div>
              ))}

              {/* Time blocks */}
              {timeBlocks.map((block) => (
                <div
                  key={block.id}
                  className="absolute right-16 left-4 rounded-md z-[2] flex items-center justify-between px-2 group overflow-hidden"
                  style={{
                    top: getTopOffset(block.start_time),
                    height: getHeight(block.start_time, block.end_time),
                    backgroundImage:
                      "repeating-linear-gradient(45deg, transparent 0, transparent 5px, hsl(var(--muted-foreground) / 0.25) 5px, hsl(var(--muted-foreground) / 0.25) 7px)",
                    border: "1px dashed hsl(var(--muted-foreground) / 0.4)",
                  }}
                >
                  <span className="text-xs text-muted-foreground truncate">
                    🚫 {block.start_time.substring(0, 5)}-{block.end_time.substring(0, 5)}{" "}
                    {block.notes && `• ${block.notes}`}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDeleteBlock(block.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}

              {/* Appointments */}
              {(() => {
                // Detect overlaps and assign columns
                const toMin = (t: string) => {
                  const [h, m] = t.substring(0, 5).split(":").map(Number);
                  return h * 60 + m;
                };
                const sorted = [...appointments].sort((a, b) => toMin(a.start_time) - toMin(b.start_time));
                const cols: number[] = new Array(sorted.length).fill(0);
                const maxCol: number[] = new Array(sorted.length).fill(0);

                for (let i = 0; i < sorted.length; i++) {
                  const usedCols = new Set<number>();
                  for (let j = 0; j < i; j++) {
                    if (
                      toMin(sorted[j].end_time) > toMin(sorted[i].start_time) &&
                      toMin(sorted[j].start_time) < toMin(sorted[i].end_time)
                    ) {
                      usedCols.add(cols[j]);
                    }
                  }
                  let col = 0;
                  while (usedCols.has(col)) col++;
                  cols[i] = col;
                }

                // Calculate max concurrent for each appointment
                for (let i = 0; i < sorted.length; i++) {
                  let max = cols[i];
                  for (let j = 0; j < sorted.length; j++) {
                    if (
                      i !== j &&
                      toMin(sorted[j].end_time) > toMin(sorted[i].start_time) &&
                      toMin(sorted[j].start_time) < toMin(sorted[i].end_time)
                    ) {
                      max = Math.max(max, cols[j]);
                    }
                  }
                  maxCol[i] = max + 1;
                }

                return sorted.map((apt, idx) => {
                  const color = apt.treatments?.color || "hsl(var(--primary))";
                  const totalCols = maxCol[idx];
                  const col = cols[idx];
                  const widthPercent = 100 / totalCols;
                  const leftPercent = col * widthPercent;

                  return (
                    <div
                      key={apt.id}
                      className="absolute rounded-md z-[3] flex items-stretch overflow-hidden shadow-sm cursor-pointer group"
                      style={{
                        top: getTopOffset(apt.start_time),
                        height: getHeight(apt.start_time, apt.end_time),
                        ...(totalCols === 1
                          ? { right: "64px", left: "16px" }
                          : {
                              right: `calc(64px + (100% - 64px - 16px) * ${leftPercent / 100})`,
                              width: `calc((100% - 64px - 16px) * ${widthPercent / 100})`,
                            }),
                      }}
                      onClick={() => openEditDialog(apt)}
                    >
                      {(() => {
                        const [sh, sm] = apt.start_time.substring(0, 5).split(":").map(Number);
                        const [eh, em] = apt.end_time.substring(0, 5).split(":").map(Number);
                        const dur = eh * 60 + em - (sh * 60 + sm);

                        return (
                          <>
                            <div className="w-1.5 flex-shrink-0" style={{ backgroundColor: color }} />
                            <div
                              className="flex-1 bg-card/95 backdrop-blur-sm border border-border/70 px-2 py-0.5 flex items-center min-w-0 overflow-hidden cursor-pointer"
                              style={{ borderLeftColor: color }}
                            >
                              <div className="flex flex-col gap-0 min-w-0 flex-1">
                                <span className="text-[11px] font-semibold text-foreground truncate flex items-center gap-1">
                                  {apt.profiles?.full_name || "לקוחה"} - {apt.treatments?.name}
                                  {apt.status === "cancelled" && (
                                    <Badge variant="destructive" className="text-[9px] h-3.5">
                                      בוטל
                                    </Badge>
                                  )}
                                </span>
                                <span className="text-[10px] font-mono text-muted-foreground">
                                  {apt.start_time.substring(0, 5)}-{apt.end_time.substring(0, 5)} ({dur} דק׳)
                                </span>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Calendar */}
      <Card className="shadow-card max-w-2xl mx-auto">
        <CardContent className="p-4">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDaySelect}
            locale={he}
            className="pointer-events-auto w-full"
            classNames={{
              months: "flex flex-col w-full",
              month: "space-y-4 w-full",
              caption: "flex justify-center pt-2 relative items-center",
              caption_label: "text-base font-semibold",
              nav_button: cn(
                "h-9 w-9 bg-transparent p-0 opacity-50 hover:opacity-100 inline-flex items-center justify-center rounded-md border border-input",
              ),
              nav_button_previous: "absolute left-2",
              nav_button_next: "absolute right-2",
              table: "w-full border-collapse",
              head_row: "flex w-full",
              head_cell:
                "text-muted-foreground rounded-md flex-1 h-10 font-medium text-sm flex items-center justify-center",
              row: "flex w-full mt-1",
              cell: "flex-1 h-14 text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
              day: "h-14 w-full p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground inline-flex items-center justify-center rounded-md text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              day_selected:
                "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
              day_today: "bg-accent text-accent-foreground",
              day_outside: "text-muted-foreground opacity-50",
              day_disabled: "text-muted-foreground opacity-50",
              day_hidden: "invisible",
            }}
            components={{
              DayContent: ({ date }) => {
                const dateStr = format(date, "yyyy-MM-dd");
                const count = monthCounts[dateStr] || 0;
                const colors = monthColors[dateStr] || [];
                const dots = colors.slice(0, 4);
                return (
                  <div className="flex flex-col items-center leading-tight">
                    <span className="text-sm font-medium">{date.getDate()}</span>
                    <span className="text-[10px] text-muted-foreground">{getHebrewDateShort(date)}</span>
                    {dots.length > 0 && (
                      <div className="flex gap-0.5 mt-0.5 items-center">
                        {dots.map((c, i) => (
                          <span
                            key={i}
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: c }}
                          />
                        ))}
                        {count > dots.length && (
                          <span className="text-[8px] font-semibold text-muted-foreground ml-0.5">
                            +{count - dots.length}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              },
            }}
            onMonthChange={setCurrentMonth}
          />
        </CardContent>
      </Card>

      {/* Book Dialog */}
      <Dialog open={showBookDialog} onOpenChange={setShowBookDialog}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>קביעת תור חדש</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {waitlist.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full border-dashed border-accent text-accent-foreground hover:bg-accent/10"
                onClick={() => setShowWaitlistPicker(true)}
              >
                <ListChecks className="h-4 w-4 ml-2" />
                בחרי מרשימת המתנה ({waitlist.length})
              </Button>
            )}
            <div className="space-y-2">
              <Label>לקוחה</Label>
              <Select
                value={bookForm.client_id}
                onValueChange={(v) => setBookForm((prev) => ({ ...prev, client_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחרי לקוחה" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.user_id} value={p.user_id}>
                      {p.full_name} {p.phone && `(${p.phone})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>טיפול</Label>
              <Select value={bookForm.treatment_id} onValueChange={onTreatmentSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="בחרי טיפול" />
                </SelectTrigger>
                <SelectContent>
                  {treatments.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.duration_minutes} דק׳)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(() => {
              const selectedTreatment = treatments.find((t) => t.id === bookForm.treatment_id);
              if (!selectedTreatment?.is_variable_duration) return null;
              const minDur = selectedTreatment.duration_minutes;
              const maxDur = 180;
              const options: number[] = [];
              for (let d = minDur; d <= maxDur; d += 5) options.push(d);
              return (
                <div className="space-y-2">
                  <Label>משך הטיפול (דקות)</Label>
                  <Select value={String(bookDuration)} onValueChange={(v) => onBookDurationChange(Number(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((d) => (
                        <SelectItem key={d} value={String(d)}>
                          {d} דקות ({Math.floor(d / 60) > 0 ? `${Math.floor(d / 60)} שעה ` : ""}
                          {d % 60 > 0 ? `${d % 60} דק׳` : ""})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })()}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>שעת התחלה</Label>
                <Input
                  type="time"
                  value={bookForm.start_time}
                  onChange={(e) => {
                    const val = e.target.value;
                    const t = treatments.find((tr) => tr.id === bookForm.treatment_id);
                    const dur = t?.is_variable_duration ? bookDuration : t?.duration_minutes || 30;
                    const [h, m] = val.split(":").map(Number);
                    const endMin = h * 60 + m + dur;
                    setBookForm((prev) => ({
                      ...prev,
                      start_time: val,
                      end_time: `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`,
                    }));
                  }}
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label>שעת סיום</Label>
                <Input
                  type="time"
                  value={bookForm.end_time}
                  onChange={(e) => setBookForm((prev) => ({ ...prev, end_time: e.target.value }))}
                  dir="ltr"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>הערות</Label>
              <Textarea
                value={bookForm.notes}
                onChange={(e) => setBookForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="הערות לתור..."
              />
            </div>
            <p className="text-xs text-muted-foreground">⚠️ תור אדמין מאפשר חפיפה עם תורים קיימים וחסימות</p>
            <Button className="w-full gradient-primary text-primary-foreground" onClick={handleAdminBook}>
              קביעת תור
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Block Dialog */}
      <Dialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <DialogContent dir="rtl" className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>חסימת זמן</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>שעת התחלה</Label>
                <Input
                  type="time"
                  value={blockForm.start_time}
                  onChange={(e) => setBlockForm((prev) => ({ ...prev, start_time: e.target.value }))}
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label>שעת סיום</Label>
                <Input
                  type="time"
                  value={blockForm.end_time}
                  onChange={(e) => setBlockForm((prev) => ({ ...prev, end_time: e.target.value }))}
                  dir="ltr"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>הערה (אופציונלי)</Label>
              <Input
                value={blockForm.notes}
                onChange={(e) => setBlockForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="סיבה..."
              />
            </div>
            <Button className="w-full" variant="outline" onClick={handleAddBlock}>
              חסימת זמן
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Appointment Dialog */}
      <Dialog
        open={showEditDialog}
        onOpenChange={(open) => {
          setShowEditDialog(open);
          if (!open) setEditingAppointment(null);
        }}
      >
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>עריכת תור</DialogTitle>
          </DialogHeader>
          {editForm && editingAppointment && (
            <div className="space-y-4">
              {/* Appointment & client details */}
              <div className="bg-muted/50 rounded-lg p-3 space-y-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{editingAppointment.profiles?.full_name || "לקוחה"}</span>
                  {editingAppointment.profiles?.phone && (
                    <span className="text-muted-foreground">({editingAppointment.profiles.phone})</span>
                  )}
                </div>
                {editingAppointment.profiles?.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>{editingAppointment.profiles.email}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: editingAppointment.treatments?.color || "hsl(var(--primary))" }}
                  />
                  <span>{editingAppointment.treatments?.name}</span>
                </div>
                <div className="text-muted-foreground">
                  {format(selectedDate, "EEEE, d בMMMM yyyy", { locale: he })} •{" "}
                  {editingAppointment.start_time.substring(0, 5)}-{editingAppointment.end_time.substring(0, 5)}
                </div>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowClientInfo(editingAppointment)}
                  >
                    <User className="h-4 w-4" /> יצירת קשר
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMoveMonth(selectedDate);
                      setShowMoveDatePicker(true);
                    }}
                  >
                    <CalendarIcon className="h-4 w-4" /> שינוי תאריך
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>שעת התחלה</Label>
                  <Input
                    type="time"
                    value={editForm.start_time}
                    onChange={(e) => setEditForm((prev) => (prev ? { ...prev, start_time: e.target.value } : null))}
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label>שעת סיום</Label>
                  <Input
                    type="time"
                    value={editForm.end_time}
                    onChange={(e) => setEditForm((prev) => (prev ? { ...prev, end_time: e.target.value } : null))}
                    dir="ltr"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>סטטוס</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(v) => setEditForm((prev) => (prev ? { ...prev, status: v } : null))}
                >
                  <SelectTrigger>
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
              <div className="space-y-2">
                <Label>הערות</Label>
                <Textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm((prev) => (prev ? { ...prev, notes: e.target.value } : null))}
                />
              </div>
              <div className="flex gap-2">
                <Button className="flex-1 gradient-primary text-primary-foreground" onClick={handleEditSave}>
                  שמירה
                </Button>
                {editingAppointment.status !== "cancelled" && (
                  <Button
                    variant="destructive"
                    className="gap-1.5"
                    onClick={() => setShowCancelConfirm(true)}
                  >
                    <Trash2 className="h-4 w-4" /> ביטול תור
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Client Info Dialog */}
      <Dialog open={!!showClientInfo} onOpenChange={() => setShowClientInfo(null)}>
        <DialogContent dir="rtl" className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>פרטי לקוחה</DialogTitle>
          </DialogHeader>
          {showClientInfo?.profiles &&
            (() => {
              const rawPhone = showClientInfo.profiles.phone?.trim() || "";
              const normalizedPhone = rawPhone.replace(/[^0-9]/g, "");
              const hasPhone = normalizedPhone.length > 0;
              const clientEmail = showClientInfo.profiles.email?.trim() || "";
              const hasEmail = clientEmail.length > 0;

              return (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{showClientInfo.profiles.full_name}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    {rawPhone ? (
                      <a href={`tel:${rawPhone}`} className="text-primary hover:underline">
                        {rawPhone}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">לא הוזן מספר טלפון</span>
                    )}
                  </div>

                  {hasEmail && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a href={`mailto:${clientEmail}`} className="text-primary hover:underline">
                        {clientEmail}
                      </a>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border">
                    {hasPhone ? (
                      <Button
                        asChild
                        size="sm"
                        className="gap-1.5 bg-[hsl(210_85%_94%)] text-[hsl(210_70%_38%)] hover:bg-[hsl(210_85%_90%)] border-0"
                      >
                        <a href={`tel:${rawPhone}`}>
                          <Phone className="h-3.5 w-3.5" /> התקשרי
                        </a>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        disabled
                        className="gap-1.5 bg-[hsl(210_35%_94%)] text-[hsl(210_20%_55%)] border-0"
                      >
                        <Phone className="h-3.5 w-3.5" /> התקשרי
                      </Button>
                    )}

                    {hasPhone ? (
                      <Button
                        asChild
                        size="sm"
                        className="gap-1.5 bg-[hsl(0_0%_92%)] text-[hsl(0_0%_35%)] hover:bg-[hsl(0_0%_88%)] border-0"
                      >
                        <a href={`sms:${rawPhone}`}>
                          <MessageSquare className="h-3.5 w-3.5" /> SMS
                        </a>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        disabled
                        className="gap-1.5 bg-[hsl(0_0%_92%)] text-[hsl(0_0%_35%)] hover:bg-[hsl(0_0%_88%)] border-0"
                      >
                        <MessageSquare className="h-3.5 w-3.5" /> SMS
                      </Button>
                    )}

                    {hasEmail ? (
                      <Button
                        asChild
                        size="sm"
                        className="gap-1.5 bg-[hsl(0_85%_95%)] text-[hsl(0_70%_45%)] hover:bg-[hsl(0_85%_91%)] border-0"
                      >
                        <a href={`mailto:${clientEmail}`}>
                          <Mail className="h-3.5 w-3.5" /> מייל
                        </a>
                      </Button>
                    ) : (
                      <Button size="sm" disabled className="gap-1.5 bg-[hsl(0_25%_94%)] text-[hsl(0_15%_55%)] border-0">
                        <Mail className="h-3.5 w-3.5" /> מייל
                      </Button>
                    )}
                  </div>
                </div>
              );
            })()}
        </DialogContent>
      </Dialog>

      {/* Waitlist Contact Dialog */}
      <Dialog open={!!waitlistContactEntry} onOpenChange={() => setWaitlistContactEntry(null)}>
        <DialogContent dir="rtl" className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>שליחת הצעת תור</DialogTitle>
          </DialogHeader>
          {waitlistContactEntry?.profiles && (() => {
            const rawPhone = waitlistContactEntry.profiles.phone?.trim() || "";
            const normalizedPhone = rawPhone.replace(/[^0-9]/g, "");
            const hasPhone = normalizedPhone.length > 0;
            const clientEmail = waitlistContactEntry.profiles.email?.trim() || "";
            const hasEmail = clientEmail.length > 0;
            const dateStr = format(selectedDate, "EEEE, d בMMMM yyyy", { locale: he });
            const timeStr = bookForm.start_time;
            const treatmentName = waitlistContactEntry.treatments?.name || "";
            const msgText = `שלום ${waitlistContactEntry.profiles.full_name}, התפנה תור ל${treatmentName} בתאריך ${dateStr} בשעה ${timeStr}. האם את מעוניינת?`;
            const encodedMsg = encodeURIComponent(msgText);
            const whatsappPhone = normalizedPhone.startsWith("0") ? "972" + normalizedPhone.slice(1) : normalizedPhone;

            return (
              <div className="space-y-3">
                <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                  <p className="font-medium">{waitlistContactEntry.profiles.full_name}</p>
                  {treatmentName && <p>טיפול: {treatmentName}</p>}
                  <p>תאריך מוצע: {dateStr}</p>
                  <p>שעה מוצעת: {timeStr}</p>
                </div>
                <p className="text-xs text-muted-foreground">הודעה מוכנה מראש תישלח ללקוחה. קבעי את התור רק לאחר אישורה.</p>
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
                  {hasPhone && (
                    <Button
                      asChild
                      size="sm"
                      className="gap-1.5 bg-[hsl(142_70%_45%)] text-white hover:bg-[hsl(142_70%_38%)] border-0"
                    >
                      <a href={`https://wa.me/${whatsappPhone}?text=${encodedMsg}`} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                      </a>
                    </Button>
                  )}
                  {hasPhone && (
                    <Button
                      asChild
                      size="sm"
                      className="gap-1.5 bg-[hsl(0_0%_92%)] text-[hsl(0_0%_35%)] hover:bg-[hsl(0_0%_88%)] border-0"
                    >
                      <a href={`sms:${rawPhone}?body=${encodedMsg}`}>
                        <MessageSquare className="h-3.5 w-3.5" /> SMS
                      </a>
                    </Button>
                  )}
                  {hasPhone && (
                    <Button
                      asChild
                      size="sm"
                      className="gap-1.5 bg-[hsl(210_85%_94%)] text-[hsl(210_70%_38%)] hover:bg-[hsl(210_85%_90%)] border-0"
                    >
                      <a href={`tel:${rawPhone}`}>
                        <Phone className="h-3.5 w-3.5" /> התקשרי
                      </a>
                    </Button>
                  )}
                  {hasEmail && (
                    <Button
                      asChild
                      size="sm"
                      className="gap-1.5 bg-[hsl(0_85%_95%)] text-[hsl(0_70%_45%)] hover:bg-[hsl(0_85%_91%)] border-0"
                    >
                      <a href={`mailto:${clientEmail}?subject=${encodeURIComponent("תור פנוי עבורך")}&body=${encodedMsg}`}>
                        <Mail className="h-3.5 w-3.5" /> מייל
                      </a>
                    </Button>
                  )}
                  {!hasPhone && !hasEmail && (
                    <p className="text-sm text-muted-foreground">אין פרטי קשר זמינים ללקוחה זו</p>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Waitlist Picker Dialog */}
      <Dialog open={showWaitlistPicker} onOpenChange={setShowWaitlistPicker}>
        <DialogContent dir="rtl" className="sm:max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>רשימת המתנה</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {waitlist.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">רשימת ההמתנה ריקה</p>
            )}
            {waitlist.map((entry) => (
              <div
                key={entry.id}
                className="border rounded-lg p-3 hover:bg-accent/50 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-sm">{entry.profiles?.full_name || "לקוחה"}</p>
                    <p className="text-xs text-muted-foreground">{entry.profiles?.phone}</p>
                  </div>
                  {entry.preferred_date && (
                    <Badge variant="outline" className="text-xs">
                      {format(new Date(entry.preferred_date), "dd/MM")}
                    </Badge>
                  )}
                </div>
                {entry.treatments && (
                  <p className="text-xs mt-1">
                    טיפול: {entry.treatments.name} • {entry.treatments.duration_minutes} דק׳
                  </p>
                )}
                {entry.preferred_time_start && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    שעה מועדפת: {entry.preferred_time_start.substring(0, 5)}
                    {entry.preferred_time_end ? ` - ${entry.preferred_time_end.substring(0, 5)}` : ""}
                  </p>
                )}
                {entry.notes && (
                  <p className="text-xs text-muted-foreground mt-0.5">הערות: {entry.notes}</p>
                )}
                <div className="flex gap-2 mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs gap-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      setWaitlistContactEntry(entry);
                    }}
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> שליחת הצעה
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 text-xs gap-1"
                    onClick={() => selectFromWaitlist(entry)}
                  >
                    <Plus className="h-3.5 w-3.5" /> בחירה לתור
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation */}
      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>ביטול תור</AlertDialogTitle>
            <AlertDialogDescription>
              האם את בטוחה שברצונך לבטל את התור של {editingAppointment?.profiles?.full_name || "הלקוחה"} בשעה{" "}
              {editingAppointment?.start_time.substring(0, 5)}? פעולה זו תפנה את השעה ללקוחות אחרות.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>חזרה</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAdminCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              כן, בטלי את התור
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
