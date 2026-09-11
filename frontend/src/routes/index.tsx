import {createHashRouter, Navigate, Outlet} from "react-router-dom";
import NotFound from "@/pages/NotFound";
import Editor from "@/pages/editor";
import {ROUTES} from "@/config/constant/ROUTES.ts";
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
                index: true, // ✅ this means it matches the path "/"
                element: <Navigate to={ROUTES.EDITOR} replace />
            },
            {
                path: ROUTES.EDITOR,
                element: <Editor/>
            },
        ]
    },
    {
        path: "*",
        element: <NotFound />,
    }
])
