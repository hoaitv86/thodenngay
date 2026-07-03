// ===== Core Types — Alo Thợ =====

export type UserRole = 'customer' | 'worker' | 'admin';
export type WorkerStatus = 'pending' | 'active' | 'blocked';
export type JobStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'done' | 'cancel_requested' | 'cancelled';
export type JobSource = 'app' | 'call';
export type PaymentMethod = 'cash' | 'transfer' | 'card' | 'momo' | 'zalopay' | 'other';
export type PaymentStatus = 'paid' | 'void';
export type JobLogAction =
  | 'created'
  | 'assigned'
  | 'accepted'
  | 'rejected'
  | 'started'
  | 'completed'
  | 'cancelled'
  | 'payment_logged';

// ===== Database Entities =====

export interface User {
  id: string;
  phone: string;
  name: string;
  address?: string;
  gps_location?: { lat: number; lng: number };
  role: UserRole;
  created_at: string;
}

export interface Worker {
  id: string;
  user_id: string;
  specialties: string[];
  status: WorkerStatus;
  avg_rating: number;
  total_jobs: number;
  avatar_url?: string;
  certificates?: string;
  approved_at?: string;
  // Joined fields
  user?: User;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  icon: string;
  base_price: number;
  is_active: boolean;
  updated_at: string;
}

export interface Job {
  id: string;
  job_code: string;
  customer_id: string;
  worker_id?: string;
  service_id: string;
  address: string;
  gps_location?: { lat: number; lng: number };
  customer_gps_location?: { lat: number; lng: number };
  worker_gps_location?: { lat: number; lng: number };
  assigned_at?: string;
  scheduled_at: string;
  description?: string;
  quoted_price: number;
  status: JobStatus;
  source: JobSource;
  created_by: string;
  images?: string[];
  completion_items?: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    warrantyDays: number;
  }>;
  final_amount?: number;
  warranty_days?: number;
  warranty_note?: string;
  workflow_data?: Record<string, Record<string, unknown>>;
  created_at: string;
  updated_at: string;
  // Joined fields
  customer?: User;
  worker?: Worker;
  service?: Service;
  services?: Service[];
  payment?: Payment;
  ratings?: Rating[];
}

export interface Rating {
  id: string;
  job_id: string;
  customer_id: string;
  worker_id: string;
  score: number; // 1-5
  comment?: string;
  created_at: string;
}

export interface Payment {
  id: string;
  job_id: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  paid_at?: string;
  collected_by?: string;
  note?: string;
  created_at?: string;
  updated_at?: string;
}

export interface JobLog {
  id: string;
  job_id: string;
  actor_id: string;
  action: JobLogAction;
  metadata?: Record<string, unknown>;
  created_at: string;
}

// ===== UI Types =====

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: number;
}

export interface DashboardStats {
  totalJobs: number;
  pendingJobs: number;
  activeJobs: number;
  completedJobs: number;
  totalWorkers: number;
  pendingWorkers: number;
  avgRating: number;
  revenue: number;
}
