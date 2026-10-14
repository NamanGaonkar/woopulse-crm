import { Sidebar, Topbar } from '@/components/Layout';
import { AgentPanel } from './AgentPanel';

export const metadata = { title: 'Retention Agent — WooPulse CRM' };

export default function AgentPage() {
  const hasApiKey = Boolean(process.env.GEMINI_API_KEY?.trim());

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <Topbar title="Retention Agent" />
        <div className="flex-1 p-6 space-y-6 overflow-auto">
          <AgentPanel hasApiKey={hasApiKey} />
        </div>
      </main>
    </div>
  );
}
