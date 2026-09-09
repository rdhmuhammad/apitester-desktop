import {createHashRouter} from "react-router-dom";
import NotFound from "@/pages/NotFound";

export const router = createHashRouter([
    {
        path: "/",
        element: <NotFound />,
    },
    {
        path: "*",
        element: <NotFound />,
    }
])
