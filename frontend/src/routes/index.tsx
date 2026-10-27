import {createHashRouter, Navigate, Outlet} from "react-router-dom";
import NotFound from "@/pages/NotFound";
import Editor from "@/pages/editor";
import MainLayout from "@/layout/view/MainLayout.tsx";

export const router = createHashRouter([
    {
        path: "/",
        element: (
            <MainLayout>
                <Outlet/>
            </MainLayout>
        ),
        children: [
            {
                index: true,
                element: <Navigate to="/editor" replace />
            },
            {
                path: "/editor",
                element: <Editor/>
            },
        ]
    },
    {
        path: "*",
        element: <NotFound />,
    }
])
