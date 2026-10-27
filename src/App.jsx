import { lazy, Suspense } from "react";
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
  useLocation,
} from "react-router-dom";
import RequireAuth from "./Components/shell/RequireAuth";
import GlobalLayout from "./Components/shell/GlobalLayout";
import ObraLayout from "./Components/shell/ObraLayout";
import HomeRedirect from "./Components/shell/HomeRedirect";
import Login from "./Components/views/Login";
import PinLogin from "./Components/views/PinLogin";
import SinObra from "./Components/views/SinObra";
import NotFound from "./Components/views/NotFound";
import MisObrasPage from "./features/obras/MisObrasPage";
import ObraEntry from "./features/obras/ObraEntry";
import HoyPage from "./features/obra/HoyPage";
import ResumenPage from "./features/obra/ResumenPage";
import ProgresoPage from "./features/obra/ProgresoPage";
import TorreTab from "./features/progreso/TorreTab";
import PisosTab from "./features/progreso/PisosTab";
import SeguimientoTab from "./features/progreso/SeguimientoTab";
import LogisticaPage from "./features/obra/LogisticaPage";
import ContenedoresPage from "./features/logistica/ContenedoresPage";
import RecepcionesPage from "./features/logistica/RecepcionesPage";
import IncidenciasPage from "./features/obra/IncidenciasPage";
import PersonalPage from "./features/personal/PersonalPage";
import TrabajadoresTab from "./features/personal/TrabajadoresTab";
import EquiposTab from "./features/personal/EquiposTab";
import UsuariosTab from "./features/personal/UsuariosTab";
import MaquinasTab from "./features/personal/MaquinasTab";
import ElegirContrasena from "./Components/views/ElegirContrasena";
import AreaSelector from "./pages/AreaSelector/AreaSelector";
import AdminProviders, {
  AdminOrgRequired,
} from "./features/administracion/AdminLayout";
import AdminShell from "./features/administracion/AdminShell";
import CashSessionsPage from "./features/administracion/CashSessionsPage";
import CustomersPage from "./features/administracion/CustomersPage";
import LedgerPage from "./features/administracion/LedgerPage";
import ProductsPage from "./features/administracion/ProductsPage";
import SalePage from "./features/administracion/SalePage";
import TerminalPage from "./features/administracion/TerminalPage";
import { ObraProvider } from "./obras/ObraProvider";

const FachadaWizard = lazy(() => import("./features/fachada/FachadaWizard"));

function ObraLayoutWithProvider() {
  return (
    <ObraProvider>
      <ObraLayout />
    </ObraProvider>
  );
}

/** Prefija rutas legacy (`/obras`, `/obra/...`) con `/construccion`. */
function LegacyToConstruccion() {
  const location = useLocation();
  return (
    <Navigate
      to={`/construccion${location.pathname}${location.search}${location.hash}`}
      replace
    />
  );
}

const router = createBrowserRouter([
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/pin",
    element: <PinLogin />,
  },
  {
    path: "/dev/fachada",
    element: <Navigate to="/construccion/obras/nueva" replace />,
  },
  {
    path: "/elegir-contrasena",
    element: <RequireAuth />,
    children: [{ index: true, element: <ElegirContrasena /> }],
  },
  {
    path: "/",
    element: <AreaSelector />,
  },
  {
    element: <RequireAuth />,
    children: [
      {
        path: "administracion",
        element: <AdminProviders />,
        children: [
          {
            element: <AdminOrgRequired />,
            children: [
              { path: "terminal", element: <TerminalPage /> },
              {
                element: <AdminShell />,
                children: [
                  { index: true, element: <LedgerPage /> },
                  { path: "productos", element: <ProductsPage /> },
                  { path: "venta", element: <SalePage /> },
                  { path: "clientes", element: <CustomersPage /> },
                  { path: "cajas", element: <CashSessionsPage /> },
                ],
              },
            ],
          },
        ],
      },
      {
        path: "construccion",
        children: [
          { index: true, element: <HomeRedirect /> },
          {
            element: <GlobalLayout />,
            children: [
              { path: "obras", element: <MisObrasPage /> },
              {
                path: "obras/nueva",
                element: (
                  <Suspense fallback={null}>
                    <FachadaWizard />
                  </Suspense>
                ),
              },
              { path: "sin-obras", element: <SinObra /> },
              {
                path: "sin-obra",
                element: <Navigate to="/construccion/sin-obras" replace />,
              },
            ],
          },
          {
            path: "obra/:obraId",
            element: <ObraLayoutWithProvider />,
            children: [
              { index: true, element: <ObraEntry /> },
              { path: "hoy", element: <HoyPage /> },
              { path: "resumen", element: <ResumenPage /> },
              {
                path: "progreso",
                element: <ProgresoPage />,
                children: [
                  { index: true, element: <Navigate to="torre" replace /> },
                  { path: "torre", element: <TorreTab /> },
                  { path: "pisos", element: <PisosTab /> },
                  { path: "seguimiento", element: <SeguimientoTab /> },
                ],
              },
              {
                path: "logistica",
                element: <LogisticaPage />,
                children: [
                  { index: true, element: <Navigate to="contenedores" replace /> },
                  {
                    path: "contenedores/:contenedorId?",
                    element: <ContenedoresPage />,
                  },
                  {
                    path: "recepciones",
                    element: <RecepcionesPage />,
                  },
                ],
              },
              { path: "incidencias", element: <IncidenciasPage /> },
              {
                path: "personal",
                element: <PersonalPage />,
                children: [
                  { path: "trabajadores", element: <TrabajadoresTab /> },
                  { path: "equipos", element: <EquiposTab /> },
                  { path: "usuarios", element: <UsuariosTab /> },
                  { path: "maquinas", element: <MaquinasTab /> },
                ],
              },
              {
                path: "torre",
                element: <Navigate to="../progreso/torre" replace />,
              },
              {
                path: "seguimiento",
                element: <Navigate to="../progreso/seguimiento" replace />,
              },
              {
                path: "contenedores",
                element: <Navigate to="../logistica/contenedores" replace />,
              },
            ],
          },
          { path: "equipo", element: <Navigate to="/" replace /> },
          { path: "campo", element: <Navigate to="/" replace /> },
          { path: "incidencias", element: <Navigate to="/" replace /> },
          { path: "avance", element: <Navigate to="/" replace /> },
          {
            path: "elegir-obra",
            element: <Navigate to="/construccion/obras" replace />,
          },
        ],
      },
      // Alias: URLs antiguas → /construccion/...
      { path: "obras/*", element: <LegacyToConstruccion /> },
      { path: "obra/*", element: <LegacyToConstruccion /> },
      { path: "sin-obras", element: <LegacyToConstruccion /> },
      { path: "sin-obra", element: <LegacyToConstruccion /> },
      { path: "elegir-obra", element: <Navigate to="/construccion/obras" replace /> },
      { path: "equipo", element: <Navigate to="/" replace /> },
      { path: "campo", element: <Navigate to="/" replace /> },
      { path: "incidencias", element: <Navigate to="/" replace /> },
      { path: "avance", element: <Navigate to="/" replace /> },
    ],
  },
  {
    path: "*",
    element: <NotFound />,
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
