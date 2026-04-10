import { Link, useLocation } from '@tanstack/react-router';
import { 
  LayoutDashboard, 
  Wand2, 
  CheckCircle, 
  Library, 
  Users, 
  GraduationCap, 
  BarChart3,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';

const formateurNav = [
  { to: '/' as const, label: 'Dashboard', icon: LayoutDashboard },
  { to: '/generateur' as const, label: 'Générateur', icon: Wand2 },
  { to: '/validation' as const, label: 'Validation', icon: CheckCircle },
  { to: '/banque' as const, label: 'Banque', icon: Library },
  { to: '/assignation' as const, label: 'Assignation', icon: Users },
  { to: '/resultats' as const, label: 'Résultats', icon: BarChart3 },
];

const eleveNav = [
  { to: '/eleve' as const, label: 'Mes exercices', icon: GraduationCap },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, signOut, isFormateur } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = isFormateur ? formateurNav : eleveNav;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
          <GraduationCap className="h-6 w-6 text-sidebar-primary" />
          <span className="text-base font-bold text-sidebar-foreground tracking-tight">Primo-Exercices</span>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to || 
              (item.to !== '/' && location.pathname.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-primary'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2 px-3 py-1.5">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {profile?.prenom} {profile?.nom}
              </p>
              <p className="text-xs text-muted-foreground truncate">{profile?.role}</p>
            </div>
            <button onClick={() => signOut()} className="text-muted-foreground hover:text-foreground p-1">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="flex flex-1 flex-col">
        <header className="lg:hidden flex h-14 items-center justify-between border-b border-border px-4 bg-card">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            <span className="font-bold text-sm">Primo-Exercices</span>
          </div>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="p-1.5">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </header>

        {/* Mobile nav overlay */}
        {mobileOpen && (
          <div className="lg:hidden absolute inset-0 top-14 z-50 bg-background/95 p-4">
            <nav className="space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        )}

        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-6xl p-4 lg:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
