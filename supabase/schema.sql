-- ============================================================
-- MotoWMS — Complete Fresh Supabase Database Schema
-- Run this ONCE in your Supabase SQL Editor (fresh database)
-- https://supabase.com/dashboard/project/YOUR_PROJECT/sql
-- ============================================================

-- ─── EXTENSIONS ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── ENUMS ──────────────────────────────────────────────────
CREATE TYPE user_role AS ENUM ('admin','owner','accounting','staff','dispatch');
CREATE TYPE credit_terms AS ENUM ('CASH','TERMS','POST_DATED_CHECK');
CREATE TYPE order_status AS ENUM (
  'DRAFT','PENDING_OWNER_APPROVAL','QUOTATION_GENERATED',
  'PENDING_DISPATCH_CHECK','PENDING_FINAL_APPROVAL',
  'DISPATCHED','DELIVERED','CLOSED','CANCELLED'
);
CREATE TYPE payment_method AS ENUM ('CASH','GCASH','CHECK');
CREATE TYPE payment_status AS ENUM ('UNPAID','PARTIAL','PAID');
CREATE TYPE stock_movement_type AS ENUM ('IN','OUT','ADJUSTMENT');
CREATE TYPE dispatch_status AS ENUM ('READY_FOR_DISPATCH','CHECKED','APPROVED','DISPATCHED','DELIVERED');
CREATE TYPE quotation_status AS ENUM ('DRAFT','LOCKED','SUPERSEDED');

-- ─── USER PROFILES ───────────────────────────────────────────
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'staff',
  is_active BOOLEAN NOT NULL DEFAULT true,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── CUSTOMERS ──────────────────────────────────────────────
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_code TEXT NOT NULL UNIQUE,
  business_name TEXT NOT NULL,
  contact_person TEXT NOT NULL,
  contact_number TEXT,
  address TEXT,
  tin TEXT,
  agent_name TEXT,
  credit_terms credit_terms NOT NULL DEFAULT 'CASH',
  credit_limit NUMERIC(12,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── CATEGORIES ─────────────────────────────────────────────
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── PRODUCTS (INVENTORY) ────────────────────────────────────
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  category_id UUID REFERENCES categories(id),
  brand TEXT,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER NOT NULL DEFAULT 5,
  unit_of_measure TEXT NOT NULL DEFAULT 'pcs',
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── CUSTOMER-SPECIFIC PRICING ───────────────────────────────
CREATE TABLE customer_pricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  custom_price NUMERIC(12,2) NOT NULL,
  agent_name TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(customer_id, product_id)
);

-- ─── ORDERS ─────────────────────────────────────────────────
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES customers(id),
  status order_status NOT NULL DEFAULT 'DRAFT',
  payment_method payment_method NOT NULL DEFAULT 'CASH',
  payment_status payment_status NOT NULL DEFAULT 'UNPAID',
  gcash_reference TEXT,
  check_number TEXT,
  check_date DATE,
  check_bank TEXT,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  balance_due NUMERIC(12,2) NOT NULL DEFAULT 0,
  due_date DATE,
  notes TEXT,
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  dispatched_by UUID REFERENCES user_profiles(id),
  dispatched_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── ORDER ITEMS ─────────────────────────────────────────────
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL,
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── QUOTATIONS ──────────────────────────────────────────────
CREATE TABLE quotations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  version_label TEXT NOT NULL DEFAULT 'v1',
  status quotation_status NOT NULL DEFAULT 'DRAFT',
  notes TEXT,
  created_by UUID NOT NULL REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ,
  locked_by UUID REFERENCES user_profiles(id),
  UNIQUE(order_id, version_number)
);

-- ─── PAYMENTS ────────────────────────────────────────────────
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  payment_method payment_method NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference_number TEXT,
  notes TEXT,
  recorded_by UUID NOT NULL REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── STOCK MOVEMENTS ─────────────────────────────────────────
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id),
  order_id UUID REFERENCES orders(id),
  movement_type stock_movement_type NOT NULL,
  quantity_change INTEGER NOT NULL,
  quantity_before INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── DISPATCH CHECKLISTS ──────────────────────────────────────
CREATE TABLE dispatch_checklists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE UNIQUE,
  status dispatch_status NOT NULL DEFAULT 'READY_FOR_DISPATCH',
  checked_by UUID REFERENCES user_profiles(id),
  checked_at TIMESTAMPTZ,
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE dispatch_checklist_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  checklist_id UUID NOT NULL REFERENCES dispatch_checklists(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES order_items(id),
  quantity_verified INTEGER NOT NULL DEFAULT 0,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  notes TEXT
);

-- ─── AUDIT LOGS (IMMUTABLE) ───────────────────────────────────
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES user_profiles(id),
  action_type TEXT NOT NULL,
  module TEXT NOT NULL,
  record_id UUID,
  before_data JSONB,
  after_data JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── SYSTEM SETTINGS ──────────────────────────────────────────
CREATE TABLE system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES user_profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- SEQUENCES
-- ============================================================
CREATE SEQUENCE order_seq START 1;
CREATE SEQUENCE customer_seq START 1;

-- ============================================================
-- TRIGGER FUNCTIONS
-- ============================================================

-- Auto-generate order number: ORD-YYYYMMDD-0001
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('order_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION generate_order_number();

-- Auto-generate customer code: CUST-00001
CREATE OR REPLACE FUNCTION generate_customer_code()
RETURNS TRIGGER AS $$
BEGIN
  NEW.customer_code := 'CUST-' || LPAD(NEXTVAL('customer_seq')::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_customer_code
  BEFORE INSERT ON customers
  FOR EACH ROW EXECUTE FUNCTION generate_customer_code();

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_orders_updated      BEFORE UPDATE ON orders          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_customers_updated   BEFORE UPDATE ON customers        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_products_updated    BEFORE UPDATE ON products         FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_profiles_updated    BEFORE UPDATE ON user_profiles    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_pricing_updated     BEFORE UPDATE ON customer_pricing FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ⚡ CORE BUSINESS RULE: Stock deducted ONLY at DISPATCHED
CREATE OR REPLACE FUNCTION deduct_stock_on_dispatch()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'DISPATCHED' AND OLD.status != 'DISPATCHED' THEN
    UPDATE products p
    SET stock_quantity = p.stock_quantity - oi.quantity
    FROM order_items oi
    WHERE oi.order_id = NEW.id AND p.id = oi.product_id;

    INSERT INTO stock_movements (
      product_id, order_id, movement_type,
      quantity_change, quantity_before, quantity_after,
      reason, created_by
    )
    SELECT
      oi.product_id,
      NEW.id,
      'OUT',
      -oi.quantity,
      p.stock_quantity + oi.quantity,
      p.stock_quantity,
      'Order dispatched: ' || NEW.order_number,
      NEW.dispatched_by
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_deduct_stock
  AFTER UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION deduct_stock_on_dispatch();

-- ⚡ Auto-set due_date based on credit terms
CREATE OR REPLACE FUNCTION set_due_date_on_payment()
RETURNS TRIGGER AS $$
DECLARE
  terms credit_terms;
  days  INTEGER;
BEGIN
  SELECT c.credit_terms INTO terms
  FROM customers c WHERE c.id = NEW.customer_id;

  CASE terms
    WHEN 'CASH'             THEN days := 30;
    WHEN 'TERMS'            THEN days := 60;
    WHEN 'POST_DATED_CHECK' THEN days := 30;
    ELSE days := 30;
  END CASE;

  IF NEW.payment_method = 'CHECK' AND NEW.check_date IS NOT NULL THEN
    NEW.due_date := NEW.check_date + days;
  ELSE
    NEW.due_date := CURRENT_DATE + days;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_due_date
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION set_due_date_on_payment();

-- ─── Auto-create user_profile row on Supabase Auth signup ─────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'staff'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE user_profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers                ENABLE ROW LEVEL SECURITY;
ALTER TABLE products                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories               ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_pricing         ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items              ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations               ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements          ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_checklists      ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings          ENABLE ROW LEVEL SECURITY;

-- Helper: get role of current user
CREATE OR REPLACE FUNCTION get_user_role(uid UUID)
RETURNS user_role AS $$
  SELECT role FROM user_profiles WHERE id = uid;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- user_profiles
CREATE POLICY "users_read_own"     ON user_profiles FOR SELECT USING (id = auth.uid() OR get_user_role(auth.uid()) IN ('admin','owner'));
CREATE POLICY "admin_manage_users" ON user_profiles FOR ALL    USING (get_user_role(auth.uid()) = 'admin');

-- customers
CREATE POLICY "auth_view_customers"    ON customers FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "staff_manage_customers" ON customers FOR ALL    USING (get_user_role(auth.uid()) IN ('admin','owner','staff'));

-- products
CREATE POLICY "auth_view_products"    ON products FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "staff_manage_products" ON products FOR ALL    USING (get_user_role(auth.uid()) IN ('admin','staff'));

-- categories
CREATE POLICY "auth_view_categories"    ON categories FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin_manage_categories" ON categories FOR ALL    USING (get_user_role(auth.uid()) IN ('admin','staff'));

-- customer_pricing
CREATE POLICY "auth_view_pricing"    ON customer_pricing FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "staff_manage_pricing" ON customer_pricing FOR ALL    USING (get_user_role(auth.uid()) IN ('admin','owner','staff'));

-- orders
CREATE POLICY "auth_view_orders"         ON orders FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "staff_create_orders"      ON orders FOR INSERT WITH CHECK (get_user_role(auth.uid()) IN ('admin','staff'));
CREATE POLICY "authorized_update_orders" ON orders FOR UPDATE USING (get_user_role(auth.uid()) IN ('admin','owner','staff','dispatch'));

-- order_items
CREATE POLICY "auth_view_order_items"    ON order_items FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "staff_manage_order_items" ON order_items FOR ALL    USING (get_user_role(auth.uid()) IN ('admin','staff'));

-- quotations
CREATE POLICY "auth_view_quotations"    ON quotations FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "staff_manage_quotations" ON quotations FOR ALL    USING (get_user_role(auth.uid()) IN ('admin','owner','staff'));

-- payments
CREATE POLICY "auth_view_payments"         ON payments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "accounting_manage_payments" ON payments FOR ALL    USING (get_user_role(auth.uid()) IN ('admin','accounting'));

-- stock_movements
CREATE POLICY "auth_view_stock"    ON stock_movements FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "staff_manage_stock" ON stock_movements FOR ALL    USING (get_user_role(auth.uid()) IN ('admin','staff'));

-- dispatch_checklists
CREATE POLICY "auth_view_dispatch"  ON dispatch_checklists FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "dispatch_manage"     ON dispatch_checklists FOR ALL    USING (get_user_role(auth.uid()) IN ('admin','dispatch','owner'));

-- dispatch_checklist_items
CREATE POLICY "auth_view_dispatch_items" ON dispatch_checklist_items FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "dispatch_manage_items"    ON dispatch_checklist_items FOR ALL    USING (get_user_role(auth.uid()) IN ('admin','dispatch'));

-- audit_logs (immutable — insert only)
CREATE POLICY "admin_view_audit"    ON audit_logs FOR SELECT USING (get_user_role(auth.uid()) IN ('admin','owner'));
CREATE POLICY "system_insert_audit" ON audit_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- system_settings
CREATE POLICY "auth_view_settings"    ON system_settings FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin_manage_settings" ON system_settings FOR ALL    USING (get_user_role(auth.uid()) = 'admin');

-- ============================================================
-- REALTIME — Enable live broadcasting for all key tables
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE quotations;
ALTER PUBLICATION supabase_realtime ADD TABLE payments;
ALTER PUBLICATION supabase_realtime ADD TABLE products;
ALTER PUBLICATION supabase_realtime ADD TABLE customers;
ALTER PUBLICATION supabase_realtime ADD TABLE dispatch_checklists;
ALTER PUBLICATION supabase_realtime ADD TABLE dispatch_checklist_items;
ALTER PUBLICATION supabase_realtime ADD TABLE audit_logs;

-- ============================================================
-- DEFAULT SEED DATA
-- ============================================================

-- System Settings
INSERT INTO system_settings (key, value) VALUES
  ('company_name',            '"ACLC Motorcycle Parts & Oils"'),
  ('company_address',         '"Your Company Address Here"'),
  ('company_contact',         '"09XX-XXX-XXXX"'),
  ('company_tin',             '"XXX-XXX-XXX-000"'),
  ('credit_terms_cash_days',  '30'),
  ('credit_terms_terms_days', '60'),
  ('credit_terms_check_days', '30'),
  ('low_stock_threshold',     '10'),
  ('quotation_validity_days', '7');

-- Default Product Categories
INSERT INTO categories (name, description) VALUES
  ('Engine Parts',    'Pistons, gaskets, valves, camshafts'),
  ('Oil & Lubricants','Motor oil, gear oil, brake fluid'),
  ('Electrical',      'Batteries, spark plugs, wiring'),
  ('Brake System',    'Brake pads, discs, shoes'),
  ('Suspension',      'Forks, shocks, springs'),
  ('Body Parts',      'Fairings, mirrors, seats'),
  ('Filters',         'Air, oil, fuel filters'),
  ('Tires & Wheels',  'Tires, tubes, rims'),
  ('Chain & Drive',   'Chains, sprockets, belts'),
  ('Accessories',     'Helmets, grips, stands');
