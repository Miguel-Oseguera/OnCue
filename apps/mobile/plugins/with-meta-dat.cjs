const { withXcodeProject } = require("expo/config-plugins");

const phaseName = "Embed Meta DAT Frameworks";
const frameworks = [
  "MWDATCore.framework",
  "MWDATCamera.framework",
  "MWDATSpeech.framework",
];

/** RN's spm_dependency links DAT into our static Expo pod, but does not copy
 * its dynamic framework into the application. Embed the already-built SPM
 * product in the app target and let Xcode sign it with the app's identity.
 */
function ensureMetaFrameworkEmbedding(project) {
  const objects = project.hash.project.objects;
  const entry = Object.entries(objects.PBXNativeTarget).find(
    ([id, target]) =>
      !id.endsWith("_comment") &&
      target.productType?.replaceAll('"', "") ===
        "com.apple.product-type.application",
  );
  if (!entry) throw new Error("Meta DAT: application target not found.");
  const [targetId, target] = entry;
  for (const framework of frameworks) {
    const references = objects.PBXFileReference;
    let referenceId = Object.keys(references).find(
      (id) =>
        !id.endsWith("_comment") &&
        references[id].path?.replaceAll('"', "") === framework &&
        references[id].sourceTree === "BUILT_PRODUCTS_DIR",
    );
    if (!referenceId) {
      referenceId = project.generateUuid();
      references[referenceId] = {
        isa: "PBXFileReference",
        lastKnownFileType: "wrapper.framework",
        name: framework,
        path: framework,
        sourceTree: "BUILT_PRODUCTS_DIR",
      };
      references[`${referenceId}_comment`] = framework;
      const group = Object.entries(objects.PBXGroup).find(
        ([id, item]) =>
          !id.endsWith("_comment") &&
          item.name?.replaceAll('"', "") === "Frameworks",
      );
      if (group)
        group[1].children.push({ value: referenceId, comment: framework });
    }
    const phases = objects.PBXCopyFilesBuildPhase ?? {};
    let phaseId = target.buildPhases.find(
      (item) => phases[item.value]?.name?.replaceAll('"', "") === phaseName,
    )?.value;
    if (!phaseId) {
      phaseId = project.addBuildPhase(
        [],
        "PBXCopyFilesBuildPhase",
        phaseName,
        targetId,
        "frameworks",
      ).uuid;
    }
    const phase = objects.PBXCopyFilesBuildPhase[phaseId];
    phase.dstSubfolderSpec = 10;
    phase.dstPath = '""';
    let buildId = phase.files.find(
      (item) => objects.PBXBuildFile[item.value]?.fileRef === referenceId,
    )?.value;
    if (!buildId) {
      buildId = project.generateUuid();
      objects.PBXBuildFile[buildId] = {
        isa: "PBXBuildFile",
        fileRef: referenceId,
        fileRef_comment: framework,
        settings: { ATTRIBUTES: ["CodeSignOnCopy", "RemoveHeadersOnCopy"] },
      };
      objects.PBXBuildFile[`${buildId}_comment`] =
        `${framework} in ${phaseName}`;
      phase.files.push({
        value: buildId,
        comment: `${framework} in ${phaseName}`,
      });
    }
  }
  return project;
}
module.exports = (config) =>
  withXcodeProject(config, (config) => {
    ensureMetaFrameworkEmbedding(config.modResults);
    return config;
  });
module.exports.ensureMetaFrameworkEmbedding = ensureMetaFrameworkEmbedding;
