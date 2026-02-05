import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Reader from './pages/Reader';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/read/:id" element={<Reader />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;