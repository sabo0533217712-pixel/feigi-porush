import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, Star, Phone, LayoutDashboard, Image, Info } from 'lucide-react';
import Brand from '@/components/Brand';

export default function LandingPage() {
  const { user, isAdmin } = useAuth();

  const ctaLink = user ? (isAdmin ? '/admin' : '/booking') : '/auth';
  const ctaLabel = user ? (isAdmin ? 'לוח בקרה' : 'קביעת תור') : 'קביעת תור';
  const ctaIcon = user && isAdmin ? LayoutDashboard : Calendar;
  const CtaIcon = ctaIcon;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative min-h-[85vh] flex items-center justify-center gradient-hero overflow-hidden">
        <div className="absolute inset-0 bg-black/5" />
        <div className="relative z-10 text-center px-6 max-w-2xl mx-auto animate-fade-in">
          <Brand size="xl" className="mb-10 drop-shadow-lg" />
          <p className="text-primary-foreground/85 text-lg md:text-xl font-light leading-relaxed mb-10 font-heebo">
            חוויית טיפוח אישית ומפנקת בסביבה מקצועית ואינטימית.
            <br />
            קבעי תור בקלות ותגיעי מוכנה ליום שלך.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to={ctaLink}>
              <Button
                size="lg"
                className="bg-white/95 text-dusty-rose-dark hover:bg-white font-semibold px-10 py-6 text-base shadow-elegant rounded-full"
              >
                <CtaIcon className="h-5 w-5 ml-2" />
                {ctaLabel}
              </Button>
            </Link>
            <a href="tel:+972501234567">
              <Button
                variant="outline"
                size="lg"
                className="border-white/40 text-white hover:bg-white/15 hover:text-white px-8 py-6 text-base rounded-full backdrop-blur-sm"
              >
                <Phone className="h-5 w-5 ml-2" />
                צרי קשר
              </Button>
            </a>
          </div>
        </div>

        {/* Decorative wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" className="w-full">
            <path
              d="M0,80 C360,120 1080,40 1440,80 L1440,120 L0,120 Z"
              fill="hsl(15 20% 96%)"
            />
          </svg>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
            למה לקבוע אצלנו?
          </h2>
          <p className="text-muted-foreground text-lg">הכל פשוט, נוח ומותאם אישית</p>
        </div>

        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
          {[
            { icon: Calendar, title: 'קביעת תור מהירה', desc: 'בחרי טיפול, תאריך ושעה - הכל אונליין בכמה קליקים פשוטים' },
            { icon: Clock, title: 'זמינות בזמן אמת', desc: 'ראי מיידית אילו שעות פנויות ובחרי את הזמן שנוח לך' },
            { icon: Star, title: 'טיפולים מקצועיים', desc: 'מגוון טיפולי יופי וטיפוח ברמה הגבוהה ביותר' },
          ].map((feature) => (
            <div
              key={feature.title}
              className="bg-card rounded-2xl p-8 shadow-card text-center hover:shadow-elegant transition-shadow duration-300"
            >
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-5">
                <feature.icon className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-xl font-display font-bold text-foreground mb-3">{feature.title}</h3>
              <p className="text-muted-foreground font-heebo leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Quick links */}
      <section className="py-10 px-6">
        <div className="max-w-2xl mx-auto flex items-center justify-center gap-4">
          <Link to="/gallery">
            <Button variant="outline" size="lg" className="gap-2 rounded-full">
              <Image className="h-5 w-5" /> גלריה
            </Button>
          </Link>
          <Link to="/about">
            <Button variant="outline" size="lg" className="gap-2 rounded-full">
              <Info className="h-5 w-5" /> אודות
            </Button>
          </Link>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-6">
        <div className="max-w-2xl mx-auto gradient-primary rounded-3xl p-10 md:p-14 text-center shadow-elegant">
          <h2 className="text-2xl md:text-3xl font-display font-bold text-primary-foreground mb-4">
            מוכנה להתפנק?
          </h2>
          <p className="text-primary-foreground/80 mb-8 text-lg font-heebo">
            קבעי תור עכשיו ותני לנו לדאוג ליופי שלך
          </p>
          <Link to={ctaLink}>
            <Button
              size="lg"
              className="bg-white/95 text-dusty-rose-dark hover:bg-white font-semibold px-10 py-6 text-base rounded-full"
            >
              {user ? ctaLabel : 'הרשמי וקבעי תור'}
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6 text-center space-y-3">
        <Brand size="sm" />
        <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
          <Link to="/gallery" className="hover:text-foreground transition-colors">גלריה</Link>
          <Link to="/about" className="hover:text-foreground transition-colors">אודות</Link>
        </div>
        <p className="text-muted-foreground text-sm font-heebo">
          © {new Date().getFullYear()} Feigi Porush • כל הזכויות שמורות
        </p>
      </footer>
    </div>
  );
}
