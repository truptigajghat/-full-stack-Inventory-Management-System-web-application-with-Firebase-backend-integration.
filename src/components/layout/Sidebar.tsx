import { motion } from 'motion/react';
import { 
  LayoutDashboard, 
  Package, 
  ArrowLeftRight, 
  Settings, 
  LogOut, 
  Boxes,
  Menu,
  X,
  Bell,
  Search,
  ChevronRight,
  Sun,
  Moon
} from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { cn } from '../../lib/utils';
import { Sheet, SheetContent, SheetTrigger } from '../ui/sheet';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Package, label: 'Inventory', path: '/products' },
  { icon: ArrowLeftRight, label: 'Transactions', path: '/transactions' },
  { icon: Boxes, label: 'Categories', path: '/categories' },
];

export function Sidebar({ className }: { className?: string }) {
  const location = useLocation();
  const { logout, user } = useAuth();
  const { theme, setTheme } = useTheme();

  return (
    <div className={cn("flex h-full w-64 flex-col border-r border-white/5 bg-background/60 backdrop-blur-3xl", className)}>
      <div className="flex h-20 items-center border-b border-white/5 px-8">
        <Link to="/" className="flex items-center gap-3 font-medium text-xl tracking-[0.1em] uppercase">
          <div className="bg-primary h-6 w-6 rounded-sm flex items-center justify-center text-primary-foreground shadow-[0_0_15px_rgba(255,255,255,0.1)]">
            <Package className="h-3.5 w-3.5" />
          </div>
          <span>StockPro</span>
        </Link>
      </div>

      <div className="flex-1 overflow-auto py-4">
        <nav className="space-y-1 px-3">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "group flex items-center gap-4 rounded-xl px-4 py-3 text-xs font-semibold tracking-wider uppercase transition-all duration-300",
                  isActive ? "bg-primary/10 text-primary shadow-sm" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                )}
              >
                <item.icon className={cn("h-4 w-4", isActive ? "text-primary" : "group-hover:text-primary")} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-white/5 p-6 space-y-6">
        <div className="flex items-center justify-between px-2">
           <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="rounded-full"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={logout} className="rounded-full text-destructive hover:text-destructive hover:bg-destructive/10">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex items-center gap-3 px-2">
          <Avatar className="h-9 w-9 border">
            <AvatarImage src={user?.photoURL || ''} referrerPolicy="no-referrer" />
            <AvatarFallback>{user?.email?.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col truncate">
            <span className="text-xs font-bold tracking-wider uppercase truncate">{user?.displayName || user?.email?.split('@')[0]}</span>
            <span className="text-xs text-muted-foreground truncate">{user?.email}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MobileNav() {
  return (
    <div className="lg:hidden flex h-16 items-center justify-between border-b px-4 bg-background/80 backdrop-blur-md sticky top-0 z-50">
      <Link to="/" className="flex items-center gap-2 font-bold text-lg">
        <Package className="h-5 w-5 text-primary" />
        <span>StockPro</span>
      </Link>
      
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64">
          <Sidebar className="w-full border-none" />
        </SheetContent>
      </Sheet>
    </div>
  );
}
