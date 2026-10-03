import { toast } from "sonner";

class CustomToast {
    static success(message: string) {
        toast.success(message);
    }
    static delete(message: string) {
        toast.info(message);
    }
    static error(message: string) {
        toast.error(message);
    }
}

export default CustomToast;