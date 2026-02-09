export type PlatformOs = "macos" | "windows" | "linux";
export type PlatformArch = "x64" | "arm64";

export interface PlatformInfo {
  os: PlatformOs;
  arch: PlatformArch;
  os_version: string;
}

export interface PrereqCheck {
  name: "disk_space" | "writable_data_dir" | "network" | string;
  passed: boolean;
  detail: string;
}

export interface PlatformStatus {
  platform: PlatformInfo | null;
  checks: PrereqCheck[];
  loading: boolean;
  error: string | null;
  canContinue: boolean;
}
