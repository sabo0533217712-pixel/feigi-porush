import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { getLogoUrl } from '@/hooks/useBusinessTheme';
import fallbackLogo from '@/assets/logo.png';

interface BrandProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  linkTo?: string;
  className?: string;
}

export default function Brand({ size = 'md', linkTo, className }: BrandProps) {
  const sizeClasses = {
    sm: 'h-12',
    md: 'h-16',
    lg: 'h-28',
    xl: 'h-40 md:h-56',
  };

  const dynamicLogo = getLogoUrl();
  const src = dynamicLogo || fallbackLogo;

  const content = (
    <div className={cn('flex items-center justify-center', className)}>
      <img
        src={src}
        alt="יופי בנגיעה אישית"
        className={cn('object-contain shadow-card', sizeClasses[size])}
      />
    </div>
  );

  if (linkTo) {
    return (
      <Link to={linkTo} className="hover:opacity-90 transition-opacity">
        {content}
      </Link>
    );
  }

  return content;
}
