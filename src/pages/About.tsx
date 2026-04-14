import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import Brand from '@/components/Brand';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

export default function About() {
  const [businessName, setBusinessName] = useState('');
  const [customTexts, setCustomTexts] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data } = await supabase.from('business_settings').select('business_name, custom_texts').limit(1).single();
    if (data) {
      setBusinessName(data.business_name);
      if (data.custom_texts && typeof data.custom_texts === 'object') {
        setCustomTexts(data.custom_texts as Record<string, string>);
      }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16 px-4">
          <Brand size="sm" linkTo="/" />
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowRight className="h-4 w-4" /> חזרה
            </Button>
          </Link>
        </div>
      </header>

      <main className="container px-4 py-10 max-w-2xl mx-auto">
        <h1 className="text-3xl font-display font-bold text-foreground text-center mb-8">
          אודות {businessName}
        </h1>

        <div className="prose prose-lg max-w-none text-center space-y-6">
          <p className="text-muted-foreground text-lg leading-relaxed font-heebo">
            {customTexts.about || 'ברוכות הבאות! אנחנו מציעות חוויית טיפוח אישית ומפנקת בסביבה מקצועית ואינטימית. הצוות שלנו מחויב לספק את הטיפולים הטובים ביותר עם תשומת לב לכל פרט.'}
          </p>

          {customTexts.about_extra && (
            <p className="text-muted-foreground leading-relaxed font-heebo">
              {customTexts.about_extra}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
