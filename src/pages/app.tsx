import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TabProvider } from '../contexts/tab-context';
import { FileProvider } from '../contexts/file-context';
import { ApiProvider } from '../contexts/api-context';
import { CartProvider } from '../contexts/cart-context';
import { MosaicCoordinatorProvider } from '../contexts/mosaic-coordinator-context';
import { BucketProvider } from '../contexts/bucket-context';
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
        <CartProvider>
          <FileProvider>
            <MosaicCoordinatorProvider>
              <BucketProvider>
                <TabProvider>
                  <AppLayout />
                </TabProvider>
              </BucketProvider>
            </MosaicCoordinatorProvider>
          </FileProvider>
        </CartProvider>
      </QueryClientProvider>
    </ApiProvider>
  );
}
