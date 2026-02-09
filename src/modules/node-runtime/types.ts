export interface NodeStatus {
  installed: boolean;
  version: string | null;
  node_path: string | null;
  npm_path: string | null;
}

export interface InstallProgress {
  stage: string;
  percent: number | null;
  detail: string;
}

export interface NodeRuntimeState {
  status: NodeStatus | null;
  progress: InstallProgress | null;
  loading: boolean;
  installing: boolean;
  error: string | null;
}
