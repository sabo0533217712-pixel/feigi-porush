import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import logo from '@/assets/logo.png';

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


  const content = (
    <div className={cn('flex items-center justify-center', className)}>
      <img
        src={logo}
        alt="Feigi Porush - יופי בנגיעה אישית"
        className={cn('object-contain shadow-card', sizeClasses[size], roundedClasses[size])}
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
