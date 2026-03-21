import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TabProvider } from '../contexts/tab-context';
import { FileProvider } from '../contexts/file-context';
import { FileSetProvider } from '../contexts/fileset-context';
import { UploadedFilesProvider } from '../contexts/uploaded-files-context';
import { ApiProvider } from '../contexts/api-context';
import { CartProvider } from '../contexts/cart-context';
import { MosaicCoordinatorProvider } from '../contexts/mosaic-coordinator-context';
import { BucketProvider } from '../contexts/bucket-context';
import { SettingsProvider } from '../contexts/settings-context';
import { Toaster } from 'sonner';
import { AppLayout } from '../components/layout/app-layout';
import { ErrorBoundary } from '../components/shared/error-boundary';

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
    <SettingsProvider>
      <ApiProvider>
        <QueryClientProvider client={queryClient}>
          <CartProvider>
            <FileProvider>
              <UploadedFilesProvider>
                <FileSetProvider>
                  <MosaicCoordinatorProvider>
                    <BucketProvider>
                      <TabProvider>
                        <ErrorBoundary>
                          <AppLayout />
                        </ErrorBoundary>
                        <Toaster position="top-center" />
                      </TabProvider>
                    </BucketProvider>
                  </MosaicCoordinatorProvider>
                </FileSetProvider>
              </UploadedFilesProvider>
            </FileProvider>
          </CartProvider>
        </QueryClientProvider>
      </ApiProvider>
    </SettingsProvider>
  );
}
