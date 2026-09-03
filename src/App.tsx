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
import Trains from './pages/trains.jsx'
import Upload from './pages/upload.jsx'
import AuthGuard from './components/AuthGuard.jsx'
import Header from './components/Header.jsx'
import Sidebar from './components/Sidebar.jsx'
import { DatasetProvider } from './context/DatasetContext.jsx'
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
                  path="/roster"
                  element={
                    <AuthGuard>
                      <Roster />
                    </AuthGuard>
                  }
                />
                <Route
                  path="/staff"
                  element={
                    <AuthGuard>
                      <StaffRoster />
                    </AuthGuard>
                  }
                />
                <Route
                  path="/staff/train/:trainNo"
                  element={
                    <AuthGuard>
                      <Staff />
                    </AuthGuard>
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
                    <AuthGuard>
                      <StaffOperation />
                    </AuthGuard>
                  }
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
                    <AuthGuard>
                      <Diagram />
                    </AuthGuard>
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
