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
    sm: 'h-10',
    md: 'h-14',
    lg: 'h-24',
    xl: 'h-36 md:h-48',
  };

  const content = (
    <div className={cn('flex items-center justify-center', className)}>
      <img
        src={logo}
        alt="Feigi Porush - יופי בנגיעה אישית"
        className={cn('object-contain', sizeClasses[size])}
      />
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
