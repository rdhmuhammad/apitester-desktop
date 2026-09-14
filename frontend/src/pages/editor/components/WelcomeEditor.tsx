import banner from "@/assets/images/api-tester-banner.png"

const WelcomeEditor = () => {
    return (
        <div className="flex flex-col items-center justify-center py-24 text-center">
            <img src={banner} alt="Welcome" className="mb-8 w-64 h-auto"/>
            <h2 className="text-xl font-semibold text-foreground">No Collection Loaded</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Pull a collection from the repository first to start editing and sending API requests.
                Use the <kbd className="rounded border border-border bg-muted px-1 font-mono text-[11px] text-foreground">Pull</kbd> button in the header.
            </p>
        </div>
    )
}

export default WelcomeEditor
