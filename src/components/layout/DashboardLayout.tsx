import React from 'react';
import { Sidebar, MobileNav } from './Sidebar';
import { Toaster } from 'sonner';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <Sidebar className="hidden lg:flex fixed left-0 top-0 bottom-0" />
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:pl-64">
        <MobileNav />
        <main className="flex-1 p-4 md:p-8 lg:p-10 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
      <Toaster position="top-right" richColors />
    </div>
  );
}
