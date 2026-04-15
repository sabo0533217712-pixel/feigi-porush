import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Calendar, Settings, User, LogOut, Sparkles, LayoutDashboard, UserCircle } from 'lucide-react';
import Brand from '@/components/Brand';

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, isAdmin, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const navItems = isAdmin
    ? [
        { to: '/admin', label: 'לוח בקרה', icon: LayoutDashboard },
        { to: '/admin/treatments', label: 'טיפולים', icon: Sparkles },
        { to: '/admin/settings', label: 'הגדרות', icon: Settings },
        { to: '/admin/calendar', label: 'יומן', icon: Calendar },
      ]
    : [
        { to: '/booking', label: 'קביעת תור', icon: Calendar },
        { to: '/my-appointments', label: 'התורים שלי', icon: User },
        { to: '/profile', label: 'פרופיל', icon: UserCircle },
      ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-card/80 backdrop-blur-sm">
        <div className="container flex items-center justify-between h-16 px-4">
          <Brand size="sm" linkTo={isAdmin ? '/admin' : '/booking'} />
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(item => (
              <Link key={item.to} to={item.to}>
                <Button
                  variant={location.pathname === item.to ? 'secondary' : 'ghost'}
                  size="sm"
                  className="gap-2"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            ))}
          </nav>
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2 text-muted-foreground">
            <LogOut className="h-4 w-4" />
            <span className="hidden md:inline">התנתקי</span>
          </Button>
        </div>
      </header>

      {/* Mobile nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-card/95 backdrop-blur-sm">
        <div className="flex items-center justify-around h-14">
          {navItems.map(item => (
            <Link key={item.to} to={item.to} className="flex-1">
              <div className={`flex flex-col items-center gap-0.5 py-1 ${location.pathname === item.to ? 'text-primary' : 'text-muted-foreground'}`}>
                <item.icon className="h-5 w-5" />
                <span className="text-[10px]">{item.label}</span>
              </div>
            </Link>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="container px-4 py-6 pb-20 md:pb-6">
        {children}
      </main>
    </div>
  );
}
