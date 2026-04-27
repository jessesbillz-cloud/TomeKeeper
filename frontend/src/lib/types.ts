/**
 * TypeScript mirrors of the backend Pydantic models. Keep in sync by hand
 * for now; if drift becomes painful we can generate from the FastAPI OpenAPI
 * schema (`openapi-typescript`) later.
 */

export type UUID = string;
export type ISODate = string; // YYYY-MM-DD
export type ISODateTime = string; // RFC 3339

export type LibraryStatus =
  | "upcoming"
  | "ordered"
  | "shipped"
  | "owned"
  | "for_sale"
  | "sold"
  | "missed";

export interface Work {
  id: UUID;
  title: string;
  author: string | null;
  series: string | null;
  series_number: number | null;
  base_description: string | null;
  original_pub_year: number | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface Edition {
  id: UUID;
  work_id: UUID;
  edition_name: string;
  publisher_or_shop: string | null;
  retailer: string | null;
  cover_url: string | null;
  release_date: ISODate | null;
  release_time: string | null;
  release_timezone: string | null;
  edition_size: number | null;
  special_features: string | null;
  isbn: string | null;
  preorder_start_at: ISODateTime | null;
  preorder_end_at: ISODateTime | null;
  submitted_by_user_id: UUID | null;
  verified: boolean;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface LibraryEntry {
  id: UUID;
  user_id: UUID;
  edition_id: UUID;
  status: LibraryStatus;
  condition: string | null;
  personal_photo_url: string | null;
  purchase_price: string | null; // Decimal serialized as string
  sale_price: string | null;
  sale_notes: string | null;
  buyer_info: string | null;
  status_changed_at: ISODateTime;
  notes: string | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface Order {
  id: UUID;
  user_id: UUID;
  edition_id: UUID | null;
  library_entry_id: UUID | null;
  vendor: string | null;
  order_date: ISODate | null;
  ship_date: ISODate | null;
  delivery_date: ISODate | null;
  tracking_number: string | null;
  receipt_photo_url: string | null;
  raw_email_id: UUID | null;
  parse_confidence: string | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface FlashSale {
  id: UUID;
  user_id: UUID;
  shop: string;
  title: string | null;
  url: string | null;
  edition_id: UUID | null;
  starts_at: ISODateTime;
  ends_at: ISODateTime;
  notes: string | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface PublisherSalesEvent {
  id: UUID;
  user_id: UUID;
  publisher: string;
  title: string | null;
  url: string | null;
  edition_id: UUID | null;
  starts_at: ISODateTime;
  ends_at: ISODateTime;
  notes: string | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface Subscription {
  id: UUID;
  user_id: UUID;
  provider: string;
  monthly_cost: string | null; // Decimal serialized as string
  renewal_date: ISODate | null;
  website: string | null;
  notes: string | null;
  last_checked_at: ISODateTime | null;
  next_known_release: ISODate | null;
  next_known_title: string | null;
  next_known_notes: string | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export type CalendarEventType =
  | "release"
  | "ship"
  | "deliver"
  | "preorder_open"
  | "preorder_close"
  | "flash_sale"
  | "publisher_sale_start"
  | "publisher_sale_end";

export interface CalendarEvent {
  date: ISODate;
  type: CalendarEventType;
  title: string;
  subtitle: string | null;
  shop: string | null;
  at: ISODateTime | null;
  edition_id: UUID | null;
  library_entry_id: UUID | null;
  order_id: UUID | null;
  flash_sale_id: UUID | null;
  publisher_sale_event_id?: UUID | null;
}
