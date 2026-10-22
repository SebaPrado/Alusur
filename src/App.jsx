import { createBrowserRouter, RouterProvider } from "react-router-dom";
import RequireAuth from "./Components/shell/RequireAuth";
import AppShell from "./Components/shell/AppShell";
import HomeRedirect from "./Components/shell/HomeRedirect";
import Login from "./Components/views/Login";
import PinLogin from "./Components/views/PinLogin";
import SinObra from "./Components/views/SinObra";
import ElegirObra from "./Components/views/ElegirObra";
import PlaceholderPage from "./Components/views/PlaceholderPage";
import NotFound from "./Components/views/NotFound";

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
    path: "/",
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <HomeRedirect /> },
      { path: "elegir-obra", element: <ElegirObra /> },
      { path: "sin-obra", element: <SinObra /> },
      {
        path: "obras",
        element: (
          <PlaceholderPage
            title="Obras"
            paso={2}
            menuVisible={({ isCeo }) => isCeo}
          />
        ),
      },
      {
        path: "equipo",
        element: (
          <PlaceholderPage
            title="Equipo y logística"
            paso={3}
            menuVisible={({ isCeo, role }) =>
              isCeo || role === "superadmin"
            }
          />
        ),
      },
      {
        path: "campo",
        element: (
          <PlaceholderPage
            title="Campo"
            paso={4}
            menuVisible={({ role, profile }) =>
              role === "obrero" || profile?.is_worker
            }
          />
        ),
      },
      {
        path: "incidencias",
        element: (
          <PlaceholderPage
            title="Incidencias"
            paso={5}
            menuVisible={({ isCeo, role }) =>
              isCeo || role === "admin" || role === "superadmin"
            }
          />
        ),
      },
      {
        path: "avance",
        element: (
          <PlaceholderPage
            title="Avance"
            paso={6}
            menuVisible={({ isCeo, role }) =>
              isCeo ||
              role === "owner" ||
              role === "admin" ||
              role === "superadmin"
            }
          />
        ),
      },
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
