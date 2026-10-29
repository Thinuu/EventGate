import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';


const DashboardLayout = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden" 
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <Sidebar 
        isMobileOpen={isMobileMenuOpen} 
        onClose={() => setIsMobileMenuOpen(false)}
        onOpen={() => setIsMobileMenuOpen(true)}
      />
      
      <main className="flex-1 overflow-auto">
        <Header onMenuClick={() => setIsMobileMenuOpen(true)} />
        <div className="mx-auto w-full max-w-7xl px-4 py-6 pb-24 lg:pb-6">{children}</div>
      </main>
    </div>
  );
};

export default DashboardLayout;
