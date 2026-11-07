import assert from "node:assert/strict"
import {test} from "node:test"
import {compareVersions, findInstaller} from "../dist-electron/release.js"

const asset = {
    name: "Apitester-Setup-v0.3.0.exe",
    size: 120,
    digest: `sha256:${"a".repeat(64)}`,
    browser_download_url: "https://github.com/rdhmuhammad/apitester-desktop/releases/download/v0.3.0/Apitester-Setup-v0.3.0.exe",
}

test("only a newer stable release exposes the matching verified installer", () => {
    assert.ok(compareVersions("0.3.0", "0.2.9") > 0)
    assert.ok(compareVersions("0.2.9", "0.3.0") < 0)
    assert.equal(findInstaller({tag_name: "v0.3.0", assets: [asset]}, "0.3.0"), null)
    assert.deepEqual(findInstaller({tag_name: "v0.3.0", assets: [asset]}, "0.2.0"), {version: "0.3.0", asset})
    assert.throws(() => findInstaller({tag_name: "v0.3.0", assets: [{...asset, digest: ""}]}, "0.2.0"))
    assert.throws(() => findInstaller({tag_name: "v0.3.0", assets: [{...asset, browser_download_url: "https://evil.example/setup.exe"}]}, "0.2.0"))
    assert.throws(() => findInstaller({tag_name: "v0.3.0-beta", assets: [asset]}, "0.2.0"))
    assert.throws(() => findInstaller({tag_name: "0.3.0", assets: [asset]}, "0.2.0"))
})
