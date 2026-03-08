import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface BrandProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  linkTo?: string;
  className?: string;
  showSubtitle?: boolean;
}

export default function Brand({ size = 'md', linkTo, className, showSubtitle = false }: BrandProps) {
  const sizeClasses = {
    sm: { name: 'text-lg tracking-[0.15em]', subtitle: 'text-[10px] tracking-[0.08em]', gap: 'gap-0' },
    md: { name: 'text-2xl tracking-[0.18em]', subtitle: 'text-xs tracking-[0.1em]', gap: 'gap-0.5' },
    lg: { name: 'text-4xl tracking-[0.2em]', subtitle: 'text-sm tracking-[0.12em]', gap: 'gap-1' },
    xl: { name: 'text-5xl md:text-6xl tracking-[0.22em]', subtitle: 'text-base md:text-lg tracking-[0.14em]', gap: 'gap-1.5' },
  };

  const s = sizeClasses[size];

  const content = (
    <div className={cn('flex flex-col items-center', s.gap, className)}>
      {/* Decorative flower accent */}
      {(size === 'lg' || size === 'xl') && (
        <svg viewBox="0 0 40 30" className={cn('text-primary/60', size === 'xl' ? 'w-12 h-9 mb-1' : 'w-8 h-6')} fill="none" stroke="currentColor" strokeWidth="1.2">
          <path d="M20 28 C20 18, 12 12, 8 8 C12 10, 16 8, 20 2 C24 8, 28 10, 32 8 C28 12, 20 18, 20 28Z" />
          <path d="M14 20 C10 22, 4 20, 2 16" strokeLinecap="round" />
          <path d="M26 20 C30 22, 36 20, 38 16" strokeLinecap="round" />
        </svg>
      )}
      <span className={cn('font-display font-semibold text-primary uppercase', s.name)}>
        Feigi Porush
      </span>
      {showSubtitle && (
        <span className={cn('font-heebo text-muted-foreground font-light', s.subtitle)}>
          יופי בנגיעה אישית
        </span>
      )}
    </div>
  );

  if (linkTo) {
    return (
      <Link to={linkTo} className="hover:opacity-80 transition-opacity">
        {content}
      </Link>
    );
  }

  return content;
}
