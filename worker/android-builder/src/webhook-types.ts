export type AndroidBuildDispatchPayload = {
  jobId: string;
  projectId: string;
  ownerId: string;
  buildType: "apk" | "aab";
  wrapperStoragePath: string;
  wrapperDownloadUrl: string;
  packageId: string;
  versionName: string;
  versionCode: number;
  callbackUrl: string;
  callbackSecret: string;
};
