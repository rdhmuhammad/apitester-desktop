import {Sonner} from "@/components/ui/sonner";
import {TooltipProvider} from "@/components/ui/tooltip";
import {Provider} from "react-redux";
import {RouterProvider} from "react-router-dom";
import {router} from "./routes";
import {store} from "@/app/store/store.ts";
import {RequestEditorProvider} from "@/layout/context/requestEditorContext.tsx";

const App = () => (
    <Provider store={store}>
        <TooltipProvider>
            <Sonner position="top-right" richColors/>
            <RequestEditorProvider>
                <RouterProvider router={router}/>
            </RequestEditorProvider>
        </TooltipProvider>
    </Provider>
);

export default App;
