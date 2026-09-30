import { BrowserRouter, Routes, Route, Link } from "react-router-dom"
import Upload from "./pages/Upload"
import Header from "./components/Header"
import Sidebar from "./components/Sidebar"
import TestFirebase from "./pages/TestFirebase"
import Home from "./pages/Home"
import Timetable from "./pages/Timetable"
import Diagram from "./pages/Diagram"
import Lines from "./pages/Lines"
import Admin from "./pages/Admin"
import Trains from "./pages/Trains"
import Login from "./pages/Login"
import Staff from "./pages/Staff"
import StaffOperation from "./pages/StaffOperation"
import AuthGuard from "./components/AuthGuard"
import AdminGuard from "./components/AdminGuard"
import Datasets from "./pages/Datasets"
import Account from "./pages/Account"
import Privacy from "./pages/Privacy"
import { DatasetProvider } from "./context/DatasetContext"

function App() {
  return (
    <DatasetProvider>
      <BrowserRouter>
        <div className="app-root">
          <Header />

          <div className="layout">
          <Sidebar />

          <main className="content">
            <Routes>
              <Route path="/staff" element={<AuthGuard><Staff /></AuthGuard>} />
              <Route path="/datasets" element={<AuthGuard><Datasets /></AuthGuard>} />
              <Route path="/login" element={<Login />} />
              <Route path="/account" element={<AuthGuard><Account /></AuthGuard>} />
              <Route path="/staff/:trainId" element={<AuthGuard><Staff /></AuthGuard>} />
              <Route path="/staff/operation/:operationName" element={<AuthGuard><StaffOperation /></AuthGuard>} />
              <Route path="/" element={<Home />} />
              <Route path="/upload" element={<AuthGuard><Upload /></AuthGuard>} />
              <Route path="/timetable" element={<AuthGuard><Timetable /></AuthGuard>} />
              <Route path="/test" element={<AuthGuard><TestFirebase /></AuthGuard>} />
              <Route path="/diagram" element={<AuthGuard><Diagram /></AuthGuard>} />
              <Route path="/trains" element={<AuthGuard><Trains /></AuthGuard>} />
              <Route path="/lines" element={<AuthGuard><Lines /></AuthGuard>} />
              <Route path="/admin" element={<AdminGuard><Admin /></AdminGuard>} />
              <Route path="/privacy" element={<Privacy />} />
            </Routes>
          </main>
            <footer className="privacy-footer">
              <div className="privacy-footer-inner">
                <span className="privacy-footer-copy">© 2026 ACTIS / goshi4058. All rights reserved.</span>
                <Link className="privacy-footer-link" to="/privacy">プライバシーポリシー</Link>
              </div>
            </footer>
          </main>
          </div>
        </div>
      </BrowserRouter>
    </DatasetProvider>
  )
}

export default App
