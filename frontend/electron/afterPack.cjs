const path = require("path")
const fs = require("fs")

const { load } = require("resedit/cjs")

exports.default = async function afterPack(context) {
  const ResEdit = await load()

  const appOutDir = context.appOutDir
  const productName = context.packager.appInfo.productName
  const version = context.packager.appInfo.version
  const parts = version.split(".").map(Number)
  const exePath = path.join(appOutDir, `${productName}.exe`)

  if (!fs.existsSync(exePath)) {
    console.warn(`[afterPack] exe not found: ${exePath}`)
    return
  }

  const exeBuffer = fs.readFileSync(exePath)
  const exe = ResEdit.NtExecutable.from(exeBuffer)
  const res = ResEdit.NtExecutableResource.from(exe)
  const viList = ResEdit.Resource.VersionInfo.fromEntries(res.entries)

  if (!viList.length) {
    console.warn(`[afterPack] no version info found in ${exePath}`)
    return
  }

  const vi = viList[0]
  const langs = vi.getAllLanguagesForStringValues()

  for (const lang of langs) {
    vi.setStringValues(
      { lang, codepage: 1200 },
      {
        FileDescription: "Development tools",
        ProductName: "Apitester",
        CompanyName: "Ridho Muhammad",
        LegalCopyright: "Ridho muhammad 2026",
        InternalName: "apitester",
        OriginalFilename: "apitester.exe",
        FileVersion: version,
        ProductVersion: version,
      }
    )
  }

  vi.setFileVersion(parts[0], parts[1], parts[2], 0)
  vi.setProductVersion(parts[0], parts[1], parts[2], 0)
  vi.outputToResourceEntries(res.entries)

  res.outputResource(exe)
  const newBuffer = exe.generate()
  fs.writeFileSync(exePath, Buffer.from(newBuffer))

  console.log(`[afterPack] resedit applied to ${exePath}`)
}
