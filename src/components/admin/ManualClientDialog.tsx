import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface ManualClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a client is created or matched. Receives the profile's user_id (phantom or real). */
  onCreated?: (userId: string, info: { full_name: string; phone: string; email: string }) => void;
}

const errorMessage = (msg: string): string => {
  if (msg.includes("invalid_phone")) return "מספר טלפון לא תקין";
  if (msg.includes("invalid_name")) return "יש להזין שם";
  if (msg.includes("forbidden")) return "אין הרשאה";
  if (msg.includes("duplicate") || msg.includes("profiles_phone_norm_unique")) return "לקוחה עם טלפון זה כבר קיימת";
  return "שגיאה ביצירת לקוחה";
};

export default function ManualClientDialog({ open, onOpenChange, onCreated }: ManualClientDialogProps) {
  const [form, setForm] = useState({ full_name: "", phone: "", email: "" });
  const [busy, setBusy] = useState(false);

  const reset = () => setForm({ full_name: "", phone: "", email: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) {
      toast.error("יש להזין שם");
      return;
    }
    const normalized = form.phone.replace(/\D/g, "");
    if (normalized.length < 7) {
      toast.error("מספר טלפון לא תקין");
      return;
    }
    setBusy(true);
    // RPC was added manually on the production DB — types aren't aware of it yet.
    const { data, error } = await (supabase.rpc as any)("admin_create_manual_client", {
      _name: form.full_name.trim(),
      _phone: form.phone.trim(),
      _email: form.email.trim() || "",
    });
    setBusy(false);
    if (error) {
      toast.error(errorMessage(error.message));
      return;
    }
    const userId = data as unknown as string;
    toast.success("הלקוחה נוספה");
    onCreated?.(userId, {
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent dir="rtl" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>הוספת לקוחה חדשה</DialogTitle>
          <DialogDescription>
            הוספה ידנית של לקוחה למאגר. אם תירשם בעצמה לאתר עם אותו טלפון — הרשומות יאוחדו אוטומטית.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mc-name">שם מלא *</Label>
            <Input
              id="mc-name"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mc-phone">טלפון *</Label>
            <Input
              id="mc-phone"
              dir="ltr"
              type="tel"
              inputMode="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mc-email">אימייל (אופציונלי)</Label>
            <Input
              id="mc-email"
              dir="ltr"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={busy}>
              ביטול
            </Button>
            <Button type="submit" className="flex-1 gradient-primary text-primary-foreground" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "הוספה"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
