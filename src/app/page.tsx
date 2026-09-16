import Header from '@/components/Header';
import Chat from '@/components/Chat';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <div className="flex-1 container mx-auto px-4 py-8 flex flex-col items-center">
        <Chat />
      </div>
    </main>
  );
}
