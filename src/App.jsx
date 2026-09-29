import { BrowserRouter, Routes, Route } from "react-router-dom"
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
import Datasets from "./pages/Datasets"
import Account from "./pages/Account"
import { DatasetProvider } from "./context/DatasetContext"
function App() {

  return (
    <DatasetProvider>
      <BrowserRouter>

      <Header />

      <div className="layout">

        <Sidebar />

        <main className="content">

          <Routes>
            <Route
             path="/staff"
             element={<AuthGuard><Staff /></AuthGuard>}
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
              path="/login"
             element={<Login />}
            />
            <Route
              path="/account"
              element={
               <AuthGuard>
                 <Account />
               </AuthGuard>
               }
            />
           <Route
             path="/staff/:trainId"
              element={<AuthGuard><Staff /></AuthGuard>}
            />
            <Route
              path="/staff/operation/:operationName"
              element={<AuthGuard><StaffOperation /></AuthGuard>}
            />
            <Route path="/" element={<Home />} />
            <Route
             path="/upload"
             element={<AuthGuard><Upload /></AuthGuard>}
            />
            <Route 
              path="/timetable"
              element={<AuthGuard><Timetable /></AuthGuard>}
            />
            <Route
             path="/test"
             element={<AuthGuard><TestFirebase /></AuthGuard>}
            />
            <Route 
              path="/diagram"
              element={<AuthGuard><Diagram /></AuthGuard>}
            />
            <Route
              path="/trains"
              element={<AuthGuard><Trains /></AuthGuard>}
            />
            <Route 
              path="/lines"
              element={<AuthGuard><Lines /></AuthGuard>}
            />

            <Route 
              path="/admin"
              element={<AuthGuard><Admin /></AuthGuard>}
            />

          </Routes>

        </main>

      </div>

      </BrowserRouter>
    </DatasetProvider>
  )
}

export default App