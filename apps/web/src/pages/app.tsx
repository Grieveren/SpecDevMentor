import { Outlet } from 'react-router-dom';
import { ProjectDashboard } from '../sections/project-dashboard';

export const App = () => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-semibold">CodeMentor AI</h1>
          <nav className="text-sm text-slate-600">Specification-driven development training</nav>
        </div>
      </header>
      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-8 md:grid-cols-[300px_1fr]">
        <aside>
          <ProjectDashboard />
        </aside>
        <section className="rounded-lg bg-white p-6 shadow-sm">
          <Outlet />
          <p className="text-sm text-slate-600">
            Select a project to explore its specification workflow.
          </p>
        </section>
      </main>
    </div>
  );
};
