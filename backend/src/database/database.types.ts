export interface WeddingRow {
  id: string;
  partner_one: string | null;
  partner_two: string | null;
  wedding_date: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface WeddingMemberRow {
  wedding_id: string;
  user_id: string;
  role: 'owner' | 'partner';
  created_at?: string;
}

export interface GuestRow {
  id: string;
  wedding_id: string;
  name: string;
  guest_group: string;
  status: string;
}

export interface VenueRow {
  id: string;
  wedding_id: string;
  name: string;
  type: string;
  address: string;
  favorite: boolean;
}

export interface TaskRow {
  id: string;
  wedding_id: string;
  name: string;
  category: string;
  due_date: string | null;
  done: boolean;
}

export interface ExpenseRow {
  id: string;
  wedding_id: string;
  name: string;
  category: string;
  value: number | string;
  paid: boolean;
}

export interface WeddingInvitationRow {
  id: string;
  wedding_id: string;
  email: string;
  status: 'pending' | 'accepted' | 'cancelled';
  invited_by: string;
  created_at: string;
}
