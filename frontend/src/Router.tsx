import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import SimplePage from './pages/SimplePage';
import FullPage from './pages/FullPage';
import EntryPage from './pages/EntryPage';
import App from './App';

export function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<EntryPage />} />
        <Route path="/simple" element={<SimplePage />}>
          <Route index element={<Navigate to="normal" replace />} />
          <Route path=":mode" element={<App variant="simple" />} />
        </Route>
        <Route path="/full" element={<FullPage />}>
          <Route index element={<Navigate to="normal" replace />} />
          <Route path=":mode" element={<App variant="full" />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
