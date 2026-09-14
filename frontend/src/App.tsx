import {Sonner} from "@/components/ui/sonner";
import {TooltipProvider} from "@/components/ui/tooltip";
import {Provider} from "react-redux";
import {RouterProvider} from "react-router-dom";
import {router} from "./routes";
import {store} from "@/app/store/store.ts";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {ThemeProvider} from "next-themes";

const queryClient = new QueryClient();

const App = () => (
    <Provider store={store}>
        <QueryClientProvider client={queryClient}>
            <ThemeProvider attribute="class" defaultTheme="system" storageKey="apitester-theme">
                <TooltipProvider>
                    <Sonner position="top-right" richColors/>
                    <RouterProvider router={router}/>
                </TooltipProvider>
            </ThemeProvider>
        </QueryClientProvider>
    </Provider>
);

export default App;
