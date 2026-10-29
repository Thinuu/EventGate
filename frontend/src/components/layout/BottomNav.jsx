import React from 'react';
import { NavLink } from 'react-router-dom';

const BottomNav = ({ items = [] }) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200/80 bg-white/95 backdrop-blur-md md:hidden safe-area-pb">
      <div className="mx-auto flex max-w-lg items-stretch justify-between gap-1 px-2 py-1.5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  'flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-2 text-[10px] font-semibold transition',
                  isActive
                    ? 'bg-teal-50 text-teal-700'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={`h-5 w-5 ${
                      isActive ? 'text-teal-600' : 'text-slate-400'
                    }`}
                  />
                  <span className="leading-tight">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;