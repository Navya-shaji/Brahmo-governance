export interface Organization {
  id: string;
  name: string;
  config: {
    cascade_max_depth?: number;
    health_score_weights?: {
      coverage: number;
      freshness: number;
      balance: number;
      consistency: number;
    };
  };
}

export interface HierarchyLevel {
  id: string;
  org_id: string;
  level_number: number;
  level_name: string;
  department: string | null;
}

export type NodeType = 'CONSTRAINT' | 'DECISION' | 'ANTI_PATTERN' | 'FACT';
export type NodeStatus = 'ACTIVE' | 'REVIEW_REQUIRED' | 'SUPERSEDED' | 'EXPIRED' | 'LEGAL_HOLD';

export interface KnowledgeNode {
  id: string;
  org_id: string;
  hierarchy_level_id: string | null;
  type: NodeType;
  title: string;
  content: string;
  importance: number;
  status: NodeStatus;
  superseded_by: string | null;
  department: string | null;
  valid_until: string | null;
  created_by: string;
  created_at: string;
}

export type EdgeType = 'SUPPORTS' | 'CONTRADICTS' | 'SUPERSEDES' | 'DERIVED_FROM' | 'REQUIRES';

export interface Edge {
  id: string;
  source_id: string;
  target_id: string;
  edge_type: EdgeType;
  created_at: string;
}

export interface User {
  id: string;
  org_id: string;
  name: string;
  role: 'ADMIN' | 'HOD' | 'EDITOR' | 'VIEWER';
  department: string;
}

export interface AuditLog {
  id: string;
  node_id: string | null;
  action: 'CREATE' | 'SUPERSEDE' | 'STATUS_CHANGE' | 'CASCADE_TRIGGER' | 'CASCADE_SKIP' | 'LEGAL_HOLD' | 'LEGAL_RELEASE' | 'REVIEW_CONFIRMED';
  old_value: string | null;
  new_value: string | null;
  actor_id: string;
  org_id: string;
  reason: string | null;
  metadata: any;
  timestamp: string;
}

export interface PulseAlert {
  id: string;
  org_id: string;
  user_id: string;
  alert_type: 'CASCADE' | 'HEALTH_DROP' | 'STALE_NODE' | 'REVIEW_COMPLETED';
  severity: 'URGENT' | 'WARNING' | 'INFO';
  title: string;
  body: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}
