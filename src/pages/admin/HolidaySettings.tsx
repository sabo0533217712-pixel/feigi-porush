import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { invalidateHolidayCache } from "@/hooks/useHolidaySettings";

interface Row {
  holiday_desc: string;
  display_name: string;
  category: string;
  show_in_calendar: boolean;
  blocks_booking: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  major: "חגים מרכזיים",
  erev: "ערבי חג",
  cholhamoed: "חול המועד",
  fast: "צומות",
  rabbinic: "מועדים מדרבנן",
  modern: "מועדים מודרניים",
  rosh_chodesh: "ראשי חודש",
  other: "אחר",
};

const CATEGORY_ORDER = ["major", "erev", "cholhamoed", "fast", "rabbinic", "modern", "rosh_chodesh", "other"];

export default function HolidaySettings() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const { data } = await supabase
      .from("holiday_settings" as any)
      .select("holiday_desc, display_name, category, show_in_calendar, blocks_booking")
      .order("category");
    if (data) setRows(data as unknown as Row[]);
    setLoading(false);
  };

  const updateRow = async (desc: string, field: "show_in_calendar" | "blocks_booking", value: boolean) => {
    setRows((prev) => prev.map((r) => (r.holiday_desc === desc ? { ...r, [field]: value } : r)));
    const { error } = await supabase
      .from("holiday_settings" as any)
      .update({ [field]: value })
      .eq("holiday_desc", desc);
    if (error) {
      toast.error("שגיאה בעדכון");
      load();
    } else {
      invalidateHolidayCache();
    }
  };

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    rows: rows.filter((r) => r.category === cat),
  })).filter((g) => g.rows.length > 0);

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="text-lg">ניהול חגים ומועדים</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-xs text-muted-foreground">
          לכל חג: "הצג בלוח" — האם יופיע בלוח השנה. "חסום הזמנה" — האם לקוחות לא יוכלו להזמין באותו יום.
        </p>
        {loading && <p className="text-sm text-muted-foreground">טוען...</p>}
        {grouped.map((g) => (
          <div key={g.category} className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">{g.label}</h3>
            <div className="space-y-1">
              <div className="hidden sm:grid grid-cols-[1fr_auto_auto] gap-4 px-2 text-xs text-muted-foreground">
                <span></span>
                <span className="w-20 text-center">הצג בלוח</span>
                <span className="w-20 text-center">חסום הזמנה</span>
              </div>
              {g.rows.map((r) => (
                <div
                  key={r.holiday_desc}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-4 p-2 rounded-md hover:bg-muted/50"
                >
                  <span className="text-sm">{r.display_name || r.holiday_desc}</span>
                  <div className="w-20 flex justify-center">
                    <Switch
                      checked={r.show_in_calendar}
                      onCheckedChange={(v) => updateRow(r.holiday_desc, "show_in_calendar", v)}
                    />
                  </div>
                  <div className="w-20 flex justify-center">
                    <Switch
                      checked={r.blocks_booking}
                      onCheckedChange={(v) => updateRow(r.holiday_desc, "blocks_booking", v)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
