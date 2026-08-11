import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { apiConfigError } from './lib/api';
import { queryClient } from './lib/queryClient';
import { router } from './routes';

export default function App() {
  /*
    A build without VITE_API_URL cannot talk to anything, so fail here rather
    than letting every request error separately. Throwing during render is what
    puts it in front of the ErrorBoundary, which knows how to explain it.
  */
  if (apiConfigError) {
    throw new Error(apiConfigError);
  }

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
