import "./App.css";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Layout from "./Components/Layout";
import Home from "./Components/views/Home";
import About from "./Components/views/About";
import NotFound from "./Components/views/NotFound";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />, // view
    children: [
      {
        path: "",
        element: <Home />, //view
      },

      {
        path: "about",
        element: <About />, //view
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
