import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TabProvider } from '../contexts/tab-context';
import { FileProvider } from '../contexts/file-context';
import { ApiProvider } from '../contexts/api-context';
import { AppLayout } from '../components/layout/app-layout';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
});

export function App() {
  return (
    <ApiProvider>
      <QueryClientProvider client={queryClient}>
        <FileProvider>
          <TabProvider>
            <AppLayout />
          </TabProvider>
        </FileProvider>
      </QueryClientProvider>
    </ApiProvider>
  );
}
