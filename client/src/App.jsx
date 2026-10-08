import { Routes, Route, NavLink, Link } from 'react-router-dom';
import { cx } from './components/ui.jsx';
import { NewContractButton } from './components/NewContract.jsx';
import { Disclaimer } from './components/Help.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Contracts from './pages/Contracts.jsx';
import Invoices from './pages/Invoices.jsx';
import InvoiceEditor from './pages/InvoiceEditor.jsx';
import Clients from './pages/Clients.jsx';
import Settings from './pages/Settings.jsx';
import Models from './pages/Models.jsx';
import Wizard from './wizard/Wizard.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', icon: '◧', end: true },
  { to: '/contracts', label: 'Contracts', icon: '📄' },
  { to: '/invoices', label: 'Invoices', icon: '🧾' },
  { to: '/clients', label: 'Clients', icon: '👥' },
  { to: '/settings', label: 'Settings', icon: '⚙︎' },
];

export default function App() {
  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-bold tracking-tight">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-white">D</span>
            <span>DealDesk</span>
          </Link>
          <nav className="hidden gap-1 md:flex">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cx('rounded-lg px-3 py-2 text-sm font-medium', isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100')}>{n.label}</NavLink>
            ))}
          </nav>
          <span className="hidden sm:block"><NewContractButton size="sm" /></span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/contracts" element={<Contracts />} />
          <Route path="/contracts/:id/step/:step" element={<Wizard />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/invoices/:id" element={<InvoiceEditor />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/models" element={<Models />} />
          <Route path="*" element={<p>Page not found. <Link className="text-indigo-600 underline" to="/">Go home</Link></p>} />
        </Routes>
        <Disclaimer className="mt-12 border-t border-slate-200 pt-4 text-center" />
      </main>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white md:hidden">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cx('flex flex-col items-center py-2 text-[11px]', isActive ? 'text-indigo-600' : 'text-slate-500')}>
            <span className="text-lg leading-none">{n.icon}</span>{n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
