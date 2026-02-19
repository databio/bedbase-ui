import { TabProvider } from '../contexts/tab-context';
import { FileProvider } from '../contexts/file-context';
import { AppLayout } from '../components/layout/app-layout';

export function App() {
  return (
    <FileProvider>
      <TabProvider>
        <AppLayout />
      </TabProvider>
    </FileProvider>
  );
}
