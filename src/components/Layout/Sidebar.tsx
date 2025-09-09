import { Home, Settings, Users, Calendar, DollarSign, BarChart3, MapPin, FileText, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';

const sidebarItems = [
  { id: 'dashboard', label: 'الرئيسية', icon: Home, path: '/admin' },
  { id: 'billboards', label: 'إدارة اللوحات', icon: MapPin, path: '/admin/billboards' },
  { id: 'booking_requests', label: 'طلبات الحجز', icon: FileText, path: '/admin/booking-requests' },
  { id: 'shared_billboards', label: 'اللوحات المشتركة', icon: FileText, path: '/admin/shared-billboards' },
  { id: 'shared_companies', label: 'الشركات المشاركة', icon: FileText, path: '/admin/shared-companies' },
  { id: 'customers', label: 'الزبائن', icon: Users, path: '/admin/customers' },
  { id: 'users', label: 'المستخدمين', icon: Users, path: '/admin/users' },
  { id: 'pricing', label: 'أسعار الإيجار', icon: DollarSign, path: '/admin/pricing' },
  { id: 'installation', label: 'أسعار التركيب والطباعة', icon: DollarSign, path: '/admin/installation-pricing' },
  { id: 'reports', label: 'التقارير والإحصائيات', icon: BarChart3, path: '/admin/reports' },
  { id: 'contracts', label: 'العقود', icon: FileText, path: '/admin/contracts' },
  { id: 'settings', label: 'الإعدادات', icon: Settings, path: '/admin/settings' },
];

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, user, signOut } = useAuth();

  const isActive = (path: string) => {
    if (path === '/admin') return location.pathname === '/admin';
    return location.pathname.startsWith(path);
  };

  return (
    <div className={cn("flex flex-col h-full bg-sidebar text-sidebar-foreground", className)}>
      {/* الهيدر */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center shadow-glow">
            <MapPin className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-sidebar-foreground">لوحة التحكم</h1>
            <p className="text-sm text-sidebar-foreground/70">إدارة شاملة للوحات الإعلانية</p>
          </div>
        </div>
      </div>

      {/* القائمة */}
      <nav className="flex-1 p-4 space-y-2">
        {sidebarItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <Button
              key={item.id}
              variant="ghost"
              size="default"
              onClick={() => navigate(item.path)}
              className={cn(
                "w-full justify-start gap-3 h-12 px-4 text-right transition-smooth",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                active && "bg-sidebar-primary text-sidebar-primary-foreground shadow-elegant"
              )}
            >
              <Icon className="h-5 w-5 ml-auto" />
              <span className="flex-1 text-right font-medium">{item.label}</span>
            </Button>
          );
        })}
      </nav>

      {/* الجزء السفلي */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-sidebar-accent/50">
          <div className="w-10 h-10 bg-gradient-primary rounded-full flex items-center justify-center text-white font-bold">
            م
          </div>
          <div className="flex-1">
            <p className="font-medium text-sidebar-foreground">{profile?.name ? `مرحباً ${profile.name}` : 'مرحباً'}</p>
            <p className="text-sm text-sidebar-foreground/70">{user?.email || 'مستخدم'}</p>
          </div>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => { await signOut(); navigate('/auth'); }}
          className="w-full mt-3 justify-start gap-2 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <LogOut className="h-4 w-4 ml-auto" />
          <span className="flex-1 text-right">تسجيل الخروج</span>
        </Button>
      </div>
    </div>
  );
}
