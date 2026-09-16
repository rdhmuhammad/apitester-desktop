import React from "react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog.tsx";
import {Button} from "@/components/ui/button.tsx";
import {Trash2} from "lucide-react";
import {useAppDispatch, useAppSelector} from "@/app/store/hooks.ts";
import {removeEditorTab, selectEditorActiveTabId} from "@/app/slices/editorTabsSlice.ts";
import {useCollection} from "@/layout/hooks/useCollection.ts";
import {useRequestConfig} from "@/pages/editor/hooks/useRequestConfig.ts";
import CustomToast from "@/components/common/toast";

interface DeleteRequestDialogProps {
    disabled?: boolean;
}

const DeleteRequestDialog: React.FC<DeleteRequestDialogProps> = ({ disabled }) => {
    const dispatch = useAppDispatch();
    const activeTabId = useAppSelector(selectEditorActiveTabId);
    const { activeCollection } = useCollection();
    const { request, deleteRequest } = useRequestConfig(activeCollection?.id ?? "", activeTabId);

    const handleDeleteRequest = async () => {
        if (!request || !activeTabId) return;
        try {
            await deleteRequest();
            dispatch(removeEditorTab(activeTabId));
        } catch (error) {
            CustomToast.error(error instanceof Error ? error.message : String(error));
        }
    };

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    disabled={disabled || !request}
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    aria-label="Delete request"
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete request?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. The
                        request &quot;{request?.name || "Untitled request"}&quot; will be permanently deleted.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={() => void handleDeleteRequest()}
                        className="bg-destructive text-white hover:bg-destructive/90"
                    >
                        Delete request
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};

export default DeleteRequestDialog;
