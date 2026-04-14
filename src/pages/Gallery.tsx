import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import Brand from '@/components/Brand';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

export default function Gallery() {
  const [images, setImages] = useState<string[]>([]);

  useEffect(() => {
    fetchImages();
  }, []);

  const fetchImages = async () => {
    const { data } = await supabase.storage.from('gallery').list('', { limit: 50, sortBy: { column: 'created_at', order: 'desc' } });
    if (data) {
      const urls = data
        .filter(f => f.name !== '.emptyFolderPlaceholder')
        .map(f => supabase.storage.from('gallery').getPublicUrl(f.name).data.publicUrl);
      setImages(urls);
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

      <main className="container px-4 py-10 max-w-5xl mx-auto">
        <h1 className="text-3xl font-display font-bold text-foreground text-center mb-8">גלריה</h1>

        {images.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">בקרוב נעלה תמונות...</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {images.map((url, i) => (
              <div key={i} className="aspect-square rounded-xl overflow-hidden shadow-card">
                <img src={url} alt={`תמונה ${i + 1}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
