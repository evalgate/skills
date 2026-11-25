// The @evalgate/sdk release this distribution is checked and scored against.
// CI installs exactly this version; never @latest, so a new SDK release cannot
// change a result without a reviewed bump here (validate-distribution checks
// the workflow uses the same version).
export const PINNED_SDK_VERSION = "3.18.2";
export const PINNED_SDK = `@evalgate/sdk@${PINNED_SDK_VERSION}`;
