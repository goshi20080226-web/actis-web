import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Account from './pages/Account.jsx'
import Admin from './pages/Admin.jsx'
import Datasets from './pages/Datasets.jsx'
import Diagram from './pages/Diagram.jsx'
import Home from './pages/Home.jsx'
import Lines from './pages/Lines.jsx'
import Login from './pages/login.jsx'
import Staff from './pages/Staff.jsx'
import StaffRoster from './pages/StaffRoster.jsx'
import StaffOperation from './pages/StaffOperation.jsx'
import Roster from './pages/Roster.jsx'
import TestFirebase from './pages/TestFirebase.jsx'
import Timetable from './pages/Timetable.jsx'
import DepartureBoard from './pages/DepartureBoard.jsx'
import Trains from './pages/trains.jsx'
import Upload from './pages/upload.jsx'
import SharedDataset from './pages/SharedDataset.jsx'
import AuthGuard from './components/AuthGuard.jsx'
import AdminGuard from './components/AdminGuard.jsx'
import Header from './components/Header.jsx'
import Sidebar from './components/Sidebar.jsx'
import { DatasetProvider } from './context/DatasetContext.jsx'
import Privacy from './pages/Privacy.jsx'
import CrewRouteGenerator from './pages/CrewRouteGenerator.jsx'
import Terms from './pages/Terms.jsx'
import './App.css'

function App() {
  return (
    <DatasetProvider>
      <BrowserRouter>
        <div className="app-shell">
          <Header />

          <div className="layout">
            <Sidebar />

            <main className="content">
              <Routes>
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/share/:shareId" element={<SharedDataset />} />
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route
                  path="/account"
                  element={
                    <AuthGuard>
                      <Account />
                    </AuthGuard>
                  }
                />
                <Route
                  path="/datasets"
                  element={
                    <AuthGuard>
                      <Datasets />
                    </AuthGuard>
                  }
                />
                <Route
                  path="/upload"
                  element={
                    <AuthGuard>
                      <Upload />
                    </AuthGuard>
                  }
                />
                <Route
                  path="/trains"
                  element={
                    <AuthGuard>
                      <Trains />
                    </AuthGuard>
                  }
                />
                <Route
                  path="/dev/crew-route"
                  element={
                    <AdminGuard>
                      <CrewRouteGenerator />
                    </AdminGuard>
                  }
                />
                <Route
                  path="/roster"
                  element={
                    <AdminGuard>
                      <Roster />
                    </AdminGuard>
                  }
                />
                <Route
                  path="/staff"
                  element={
                    <AdminGuard>
                      <StaffRoster />
                    </AdminGuard>
                  }
                />
                <Route
                  path="/staff/train/:trainNo"
                  element={
                    <AdminGuard>
                      <Staff />
                    </AdminGuard>
                  }
                />
                <Route
                  path="/staff/:trainId"
                  element={
                    <AuthGuard>
                      <Staff />
                    </AuthGuard>
                  }
                />
                <Route
                  path="/staff/operation/:operationName"
                  element={
                    <AdminGuard>
                      <StaffOperation />
                    </AdminGuard>
                  }
                />
                <Route
                  path="/board"
                  element={<AuthGuard><DepartureBoard /></AuthGuard>}
                />
                <Route
                  path="/timetable"
                  element={
                    <AuthGuard>
                      <Timetable />
                    </AuthGuard>
                  }
                />
                <Route
                  path="/diagram"
                  element={
                    <AdminGuard>
                      <Diagram />
                    </AdminGuard>
                  }
                />
                <Route
                  path="/lines"
                  element={
                    <AuthGuard>
                      <Lines />
                    </AuthGuard>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <AuthGuard>
                      <Admin />
                    </AuthGuard>
                  }
                />
                <Route
                  path="/test"
                  element={
                    <AuthGuard>
                      <TestFirebase />
                    </AuthGuard>
                  }
                />
              </Routes>
            </main>
          </div>
        </div>
      </BrowserRouter>
    </DatasetProvider>
  )
}

export default App
