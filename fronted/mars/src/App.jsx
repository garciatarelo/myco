import Home from './views/Home';
import Dashboard from './Dashboard';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './views/LandingPage';

function App() {

  return <Router basename="marsmatrix">
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/landing" element={<LandingPage   />} />
      
    </Routes>
  </Router>;
}

export default App;