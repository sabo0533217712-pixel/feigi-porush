import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, Circle, Phone } from "lucide-react";
import { Link } from "react-router-dom";

interface PromptRow {
  key: string;
  category: string;
  label: string;
  script_text: string;
  path: string | null;
  sort_order: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  connectors: "מילות חיבור קצרות (משמשות שוב ושוב)",
  menu: "תפריט ראשי וטיפול בשגיאות",
  treatment: "בחירת טיפול",
  nearest: "התור הקרוב ביותר",
  manual_date: "תאריך ושעה ידניים",
  confirm: "אישור וקביעה סופית",
  cancel: "ביטול תור",
  hear: "שמיעת תורים קיימים",
};

const CATEGORY_ORDER = ["connectors", "menu", "treatment", "nearest", "manual_date", "confirm", "cancel", "hear"];

export default function AdminIvrPrompts() {
  const [rows, setRows] = useState<PromptRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("ivr_prompts").select("*").order("sort_order");
    if (error) {
      toast.error("שגיאה בטעינת רשימת ההקלטות");
    } else if (data) {
      setRows(data as PromptRow[]);
      setDrafts(Object.fromEntries((data as PromptRow[]).map((r) => [r.key, r.path || ""])));
    }
    setLoading(false);
  };

  const savePath = async (key: string) => {
    setSavingKey(key);
    const value = (drafts[key] || "").trim();
    const { error } = await supabase
      .from("ivr_prompts")
      .update({ path: value || null })
      .eq("key", key);
    setSavingKey(null);
    if (error) {
      toast.error("שגיאה בשמירת הנתיב");
    } else {
      toast.success("נשמר");
      setRows((prev) => prev.map((r) => (r.key === key ? { ...r, path: value || null } : r)));
    }
  };

  const grouped = useMemo(
    () =>
      CATEGORY_ORDER.map((cat) => ({
        category: cat,
        label: CATEGORY_LABELS[cat] || cat,
        rows: rows.filter((r) => r.category === cat),
      })).filter((g) => g.rows.length > 0),
    [rows],
  );

  const doneCount = rows.filter((r) => r.path && r.path.trim().length > 0).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Phone className="h-5 w-5" />
            הקלטות ל-IVR (מענה טלפוני)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            הטקסט המדויק שיש להקליט בקול שלך, להעלות לימות המשיח, ולהדביק כאן את הנתיב שקיבלת.
          </p>
        </div>
        <Badge variant={doneCount === rows.length && rows.length > 0 ? "default" : "secondary"} className="text-sm whitespace-nowrap">
          {doneCount} / {rows.length} הוקלטו
        </Badge>
      </div>

      <p className="text-sm text-muted-foreground">
        בנוסף להקלטות שברשימה כאן, יש להקליט שם לכל טיפול פעיל במסך{" "}
        <Link to="/admin/treatments" className="text-primary underline">
          ניהול טיפולים
        </Link>
        .
      </p>

      {loading && <p className="text-sm text-muted-foreground">טוען...</p>}

      {grouped.map((g) => (
        <Card key={g.category} className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{g.label}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {g.rows.map((r) => {
              const hasPath = !!r.path && r.path.trim().length > 0;
              const draft = drafts[r.key] ?? "";
              const dirty = draft !== (r.path || "");
              return (
                <div key={r.key} className="border border-border/60 rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                        {hasPath ? (
                          <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        {r.label}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1 bg-secondary/50 rounded px-2 py-1 inline-block">
                        "{r.script_text}"
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`path-${r.key}`} className="text-xs whitespace-nowrap text-muted-foreground">
                      נתיב בימות:
                    </Label>
                    <Input
                      id={`path-${r.key}`}
                      value={draft}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [r.key]: e.target.value }))}
                      placeholder="לדוגמה: 1/2/ivr/menu_welcome"
                      className="h-8 text-sm"
                      dir="ltr"
                    />
                    {dirty && (
                      <button
                        type="button"
                        onClick={() => savePath(r.key)}
                        disabled={savingKey === r.key}
                        className="text-xs font-medium text-primary hover:underline whitespace-nowrap disabled:opacity-50"
                      >
                        {savingKey === r.key ? "שומר..." : "שמירה"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
