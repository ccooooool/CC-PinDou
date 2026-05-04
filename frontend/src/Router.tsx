import { BrowserRouter, Routes, Route } from 'react-router-dom';
import EntryPage from './pages/EntryPage';
import SimplePage from './pages/SimplePage';
import FullPage from './pages/FullPage';

export function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<EntryPage />} />
        <Route path="/simple" element={<SimplePage />} />
        <Route path="/full" element={<FullPage />} />
      </Routes>
    </BrowserRouter>
  );
}
