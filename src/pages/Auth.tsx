import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import Brand from "@/components/Brand";

type ForgotStep = "phone" | "question" | "password" | "done";

export default function Auth() {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const [loading, setLoading] = useState(false);

  // Basic format validators — no actual verification, just pattern checks
  const isValidEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };
  const isValidIsraeliPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    // Israeli mobile/landline: starts with 0, 9–10 digits total
    return /^0\d{8,9}$/.test(digits);
  };

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regQuestion, setRegQuestion] = useState("");
  const [regAnswer, setRegAnswer] = useState("");
  const [regReminderPref, setRegReminderPref] = useState("whatsapp");

  // Forgot password (phone-based)
  const [forgotOpen, setForgotOpen] = useState(false);
  const [step, setStep] = useState<ForgotStep>("phone");
  const [fpPhone, setFpPhone] = useState("");
  const [fpQuestion, setFpQuestion] = useState("");
  const [fpAnswer, setFpAnswer] = useState("");
  const [fpToken, setFpToken] = useState("");
  const [fpNewPwd, setFpNewPwd] = useState("");
  const [fpNewPwd2, setFpNewPwd2] = useState("");
  const [fpBusy, setFpBusy] = useState(false);

  const resetForgot = () => {
    setStep("phone");
    setFpPhone("");
    setFpQuestion("");
    setFpAnswer("");
    setFpToken("");
    setFpNewPwd("");
    setFpNewPwd2("");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(loginEmail, loginPassword);
      toast.success("התחברת בהצלחה!");
      navigate("/");
    } catch (err: any) {
      toast.error(err.message || "שגיאה בהתחברות");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim()) return toast.error("נא להזין שם מלא");
    if (!regPhone.trim()) return toast.error("נא להזין מספר טלפון");
    if (!isValidIsraeliPhone(regPhone)) return toast.error("מספר טלפון אינו תקין (יש להזין מספר ישראלי)");
    if (!regEmail.trim()) return toast.error("נא להזין אימייל");
    if (!isValidEmail(regEmail)) return toast.error("כתובת האימייל אינה תקינה");
    if (regQuestion.trim().length < 3) return toast.error("שאלת אבטחה קצרה מדי");
    if (regAnswer.trim().length < 2) return toast.error("תשובה לשאלת האבטחה קצרה מדי");
    setLoading(true);
    try {
      await signUp(regEmail, regPassword, regName, regPhone, regQuestion, regAnswer, regReminderPref);
      toast.success("נרשמת בהצלחה!");
      navigate("/");
    } catch (err: any) {
      toast.error(err.message || "שגיאה בהרשמה");
    } finally {
      setLoading(false);
    }
  };

  // ----- Forgot password steps -----

  const errMsg = (code: string) => {
    switch (code) {
      case "rate_limited":
        return "יותר מדי ניסיונות, נסי שוב בעוד 15 דקות";
      case "invalid_phone":
        return "מספר טלפון לא תקין";
      case "not_available":
        return "לא נמצאה שאלת אבטחה עבור מספר זה. פני למנהלת המערכת.";
      case "invalid_answer":
        return "התשובה אינה נכונה";
      case "invalid_input":
        return "נתונים חסרים";
      default:
        return code || "שגיאה";
    }
  };

  const submitPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fpPhone.trim()) return toast.error("נא להזין מספר טלפון");
    if (!isValidIsraeliPhone(fpPhone)) return toast.error("מספר טלפון אינו תקין (יש להזין מספר ישראלי)");
    setFpBusy(true);
    try {
      const { data, error } = await supabase.rpc("request_password_reset", { _phone: fpPhone });
      if (error) throw error;
      const q = Array.isArray(data) ? data[0]?.security_question : (data as any)?.security_question;
      if (!q) throw new Error("not_available");
      setFpQuestion(q);
      setStep("question");
    } catch (err: any) {
      toast.error(errMsg(err.message));
    } finally {
      setFpBusy(false);
    }
  };

  const submitAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fpAnswer.trim()) return toast.error("נא להזין תשובה");
    setFpBusy(true);
    try {
      const { data, error } = await supabase.rpc("verify_security_answer", {
        _phone: fpPhone,
        _answer: fpAnswer,
      });
      if (error) throw error;
      const t = Array.isArray(data) ? data[0]?.token : (data as any)?.token;
      if (!t) throw new Error("invalid_answer");
      setFpToken(t);
      setStep("password");
    } catch (err: any) {
      toast.error(errMsg(err.message));
    } finally {
      setFpBusy(false);
    }
  };

  const submitNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fpNewPwd.length < 6) return toast.error("סיסמה חייבת להיות לפחות 6 תווים");
    if (fpNewPwd !== fpNewPwd2) return toast.error("הסיסמאות אינן תואמות");
    setFpBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("reset-password-with-token", {
        body: { token: fpToken, new_password: fpNewPwd },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "שגיאה");
      toast.success("הסיסמה עודכנה בהצלחה!");
      // Try to auto-sign-in
      if (data.email) {
        try {
          await signIn(data.email, fpNewPwd);
          setForgotOpen(false);
          resetForgot();
          navigate("/");
          return;
        } catch {
          /* fall through */
        }
      }
      setStep("done");
    } catch (err: any) {
      toast.error(err.message || "שגיאה בעדכון הסיסמה");
    } finally {
      setFpBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <Brand size="lg" linkTo="/" />
          <p className="text-muted-foreground mt-3">מערכת קביעת תורים</p>
        </div>

        <Card className="shadow-card border-border/50">
          <Tabs defaultValue="login" dir="rtl">
            <CardHeader className="pb-2">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">התחברות</TabsTrigger>
                <TabsTrigger value="register">הרשמה</TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent>
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">אימייל</Label>
                    <Input
                      id="login-email"
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      placeholder="your@email.com"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">סיסמה</Label>
                    <Input
                      id="login-password"
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      dir="ltr"
                    />
                  </div>
                  <Button type="submit" className="w-full gradient-primary text-primary-foreground" disabled={loading}>
                    {loading ? "מתחבר..." : "התחברי"}
                  </Button>
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => {
                        resetForgot();
                        setForgotOpen(true);
                      }}
                      className="text-sm text-primary hover:underline"
                    >
                      שכחתי סיסמה
                    </button>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-name">שם מלא</Label>
                    <Input
                      id="reg-name"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      required
                      placeholder="שם מלא"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-phone">טלפון</Label>
                    <Input
                      id="reg-phone"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      required
                      placeholder="050-1234567"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-email">אימייל</Label>
                    <Input
                      id="reg-email"
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      required
                      placeholder="your@email.com"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-password">סיסמה</Label>
                    <Input
                      id="reg-password"
                      type="password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      required
                      minLength={6}
                      placeholder="לפחות 6 תווים"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-question">שאלת אבטחה</Label>
                    <Input
                      id="reg-question"
                      value={regQuestion}
                      onChange={(e) => setRegQuestion(e.target.value)}
                      required
                      placeholder="לדוגמה: שם משפחה קודם"
                    />
                    <p className="text-xs text-muted-foreground">תשמש לאיפוס סיסמה אם תשכחי אותה</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-answer">תשובה</Label>
                    <Input
                      id="reg-answer"
                      value={regAnswer}
                      onChange={(e) => setRegAnswer(e.target.value)}
                      required
                      placeholder="התשובה הסודית שלך"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>איך לשלוח תזכורות?</Label>
                    <RadioGroup
                      dir="rtl"
                      value={regReminderPref}
                      onValueChange={setRegReminderPref}
                      className="flex flex-wrap gap-3 sm:gap-6"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="whatsapp" id="r-whatsapp" />
                        <Label htmlFor="r-whatsapp" className="font-normal cursor-pointer">
                          וואטסאפ
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="email" id="r-email" />
                        <Label htmlFor="r-email" className="font-normal cursor-pointer">
                          אימייל
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <Button type="submit" className="w-full gradient-primary text-primary-foreground" disabled={loading}>
                    {loading ? "נרשם..." : "הרשמי"}
                  </Button>
                </form>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        <Dialog
          open={forgotOpen}
          onOpenChange={(o) => {
            setForgotOpen(o);
            if (!o) resetForgot();
          }}
        >
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>איפוס סיסמה</DialogTitle>
              <DialogDescription>
                {step === "phone" && "הזיני את מספר הטלפון שלך כדי להתחיל"}
                {step === "question" && "עני על שאלת האבטחה שהגדרת"}
                {step === "password" && "הזיני סיסמה חדשה"}
                {step === "done" && "הסיסמה עודכנה. אפשר להתחבר עכשיו."}
              </DialogDescription>
            </DialogHeader>

            {step === "phone" && (
              <form onSubmit={submitPhone} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fp-phone">מספר טלפון</Label>
                  <Input
                    id="fp-phone"
                    value={fpPhone}
                    onChange={(e) => setFpPhone(e.target.value)}
                    placeholder="050-1234567"
                    dir="ltr"
                    required
                  />
                </div>
                <Button type="submit" className="w-full gradient-primary text-primary-foreground" disabled={fpBusy}>
                  {fpBusy ? "בודק..." : "המשך"}
                </Button>
              </form>
            )}

            {step === "question" && (
              <form onSubmit={submitAnswer} className="space-y-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">שאלת האבטחה שלך:</p>
                  <p className="text-base font-medium">{fpQuestion}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fp-answer">התשובה שלך</Label>
                  <Input id="fp-answer" value={fpAnswer} onChange={(e) => setFpAnswer(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full gradient-primary text-primary-foreground" disabled={fpBusy}>
                  {fpBusy ? "מאמת..." : "אמת"}
                </Button>
              </form>
            )}

            {step === "password" && (
              <form onSubmit={submitNewPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fp-pwd">סיסמה חדשה</Label>
                  <Input
                    id="fp-pwd"
                    type="password"
                    value={fpNewPwd}
                    onChange={(e) => setFpNewPwd(e.target.value)}
                    required
                    minLength={6}
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fp-pwd2">אימות סיסמה</Label>
                  <Input
                    id="fp-pwd2"
                    type="password"
                    value={fpNewPwd2}
                    onChange={(e) => setFpNewPwd2(e.target.value)}
                    required
                    minLength={6}
                    dir="ltr"
                  />
                </div>
                <Button type="submit" className="w-full gradient-primary text-primary-foreground" disabled={fpBusy}>
                  {fpBusy ? "מעדכן..." : "עדכון סיסמה"}
                </Button>
              </form>
            )}

            {step === "done" && (
              <Button
                className="w-full gradient-primary text-primary-foreground"
                onClick={() => {
                  setForgotOpen(false);
                  resetForgot();
                }}
              >
                סגור
              </Button>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
