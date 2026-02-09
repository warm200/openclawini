export interface OpenClawStatus {
  installed: boolean;
  version: string | null;
  binary_path: string | null;
}

export interface UpdateInfo {
  installed_version: string;
  latest_version: string;
  update_available: boolean;
}

export interface InstallProgress {
  stage: string;
  percent: number | null;
  detail: string;
}
