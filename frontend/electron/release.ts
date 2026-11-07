export type Asset = {name: string; size: number; digest: string; browser_download_url: string}
export type Release = {tag_name: string; assets: Asset[]}

const versionPattern = /^v?(\d+)\.(\d+)\.(\d+)$/

export function compareVersions(a: string, b: string): number {
    const left = a.match(versionPattern)
    const right = b.match(versionPattern)
    if (!left || !right) throw new Error("Invalid release version")
    for (let i = 1; i <= 3; i++) {
        const l = Number(left[i])
        const r = Number(right[i])
        if (!Number.isSafeInteger(l) || !Number.isSafeInteger(r)) throw new Error("Invalid release version")
        const difference = l - r
        if (difference) return difference
    }
    return 0
}

export function findInstaller(release: Release, installedVersion: string): {version: string; asset: Asset} | null {
    if (!/^v\d+\.\d+\.\d+$/.test(release.tag_name)) throw new Error("Invalid release version")
    const version = release.tag_name?.replace(/^v/, "")
    if (compareVersions(version, installedVersion) <= 0) return null
    const asset = release.assets?.find(item => item.name === `Apitester-Setup-v${version}.exe`)
    const expectedUrl = `https://github.com/rdhmuhammad/apitester-desktop/releases/download/${release.tag_name}/${asset?.name}`
    if (!asset || !Number.isSafeInteger(asset.size) || asset.size <= 0 ||
        !/^sha256:[a-f0-9]{64}$/i.test(asset.digest) || asset.browser_download_url !== expectedUrl) {
        throw new Error("Release installer metadata is invalid")
    }
    return {version, asset}
}
