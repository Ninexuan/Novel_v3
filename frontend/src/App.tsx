import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ScrollToTop from './components/ScrollToTop';
import Home from './pages/Home';
import Library from './pages/Library';
import BookSources from './pages/BookSources';
import BookDetail from './pages/BookDetail';
import Reader from './pages/Reader';

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="library" element={<Library />} />
          <Route path="sources" element={<BookSources />} />
          <Route path="book" element={<BookDetail />} />
        </Route>
        <Route path="/reader" element={<Reader />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

