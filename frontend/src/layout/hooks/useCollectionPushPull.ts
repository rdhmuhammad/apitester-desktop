export function useCollectionPushPull() {
    return {
        pull: async () => undefined,
        push: async () => undefined,
        isPulling: false,
        isPushing: false,
    }
}
