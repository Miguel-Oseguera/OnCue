const test = require("node:test");
const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const path = require("node:path");
const expoRequire = createRequire(require.resolve("expo/package.json"));
const configRequire = createRequire(
  expoRequire.resolve("@expo/config-plugins/package.json"),
);
const xcode = configRequire("xcode");
const { ensureMetaFrameworkEmbedding } = require("./with-meta-dat.cjs");

test("embeds and signs DAT once, without altering signing settings", () => {
  const project = xcode.project(
    path.join(
      path.dirname(require.resolve("./with-meta-dat.cjs")),
      "../ios/mobile.xcodeproj/project.pbxproj",
    ),
  );
  project.parseSync();
  const original = JSON.stringify(
    project.hash.project.objects.XCBuildConfiguration,
  );
  ensureMetaFrameworkEmbedding(project);
  const first = project.writeSync();
  ensureMetaFrameworkEmbedding(project);
  assert.equal(project.writeSync(), first);
  assert.equal(
    JSON.stringify(project.hash.project.objects.XCBuildConfiguration),
    original,
  );
  const objects = project.hash.project.objects;
  const phases = Object.entries(objects.PBXCopyFilesBuildPhase).filter(
    ([id, phase]) =>
      !id.endsWith("_comment") &&
      phase.name?.replaceAll('"', "") === "Embed Meta DAT Frameworks",
  );
  assert.equal(phases.length, 1);
  const phase = phases[0][1];
  assert.equal(phase.dstSubfolderSpec, 10);
  assert.equal(phase.files.length, 3);
  const paths = [];
  for (const file of phase.files) {
    const buildFile = objects.PBXBuildFile[file.value];
    assert.ok(buildFile.settings.ATTRIBUTES.includes("CodeSignOnCopy"));
    assert.ok(buildFile.settings.ATTRIBUTES.includes("RemoveHeadersOnCopy"));
    const reference = objects.PBXFileReference[buildFile.fileRef];
    paths.push(reference.path);
    assert.equal(reference.sourceTree, "BUILT_PRODUCTS_DIR");
  }
  assert.deepEqual(paths.sort(), [
    "MWDATCamera.framework",
    "MWDATCore.framework",
    "MWDATSpeech.framework",
  ]);
});
