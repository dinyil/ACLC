-- ============================================================
-- ACLC WMS — FULL FRESH SETUP (All-in-One)
-- Safe to run on a FRESH Supabase database
-- If you get errors on "already exists" lines, ignore them
-- and run the NEXT section manually.
-- ============================================================

-- ─── EXTENSIONS ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── DROP OLD TRIGGERS FIRST (so we can recreate cleanly) ────
DROP TRIGGER IF EXISTS on_auth_user_created    ON auth.users;
DROP TRIGGER IF EXISTS set_order_number        ON orders;
DROP TRIGGER IF EXISTS set_customer_code       ON customers;
DROP TRIGGER IF EXISTS trg_deduct_stock        ON orders;
DROP TRIGGER IF EXISTS set_due_date_on_payment ON orders;

-- ─── DROP OLD FUNCTIONS ───────────────────────────────────────
DROP FUNCTION IF EXISTS handle_new_user()           CASCADE;
DROP FUNCTION IF EXISTS get_user_role(UUID)         CASCADE;
DROP FUNCTION IF EXISTS generate_order_number()     CASCADE;
DROP FUNCTION IF EXISTS generate_customer_code()    CASCADE;
DROP FUNCTION IF EXISTS set_updated_at()            CASCADE;
DROP FUNCTION IF EXISTS deduct_stock_on_dispatch()  CASCADE;
DROP FUNCTION IF EXISTS set_payment_due_date()      CASCADE;

-- ─── ENUMS ───────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin','owner','accounting','staff','dispatch');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE credit_terms AS ENUM ('CASH','TERMS','POST_DATED_CHECK');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM (
    'DRAFT','PENDING_OWNER_APPROVAL','QUOTATION_GENERATED',
    'PENDING_DISPATCH_CHECK','PENDING_FINAL_APPROVAL',
    'DISPATCHED','DELIVERED','CLOSED','CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('CASH','GCASH','CHECK');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('UNPAID','PARTIAL','PAID');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE stock_movement_type AS ENUM ('IN','OUT','ADJUSTMENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE dispatch_status AS ENUM ('READY_FOR_DISPATCH','CHECKED','APPROVED','DISPATCHED','DELIVERED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE quotation_status AS ENUM ('DRAFT','LOCKED','SUPERSEDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── USER PROFILES ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL UNIQUE,
  full_name   TEXT NOT NULL,
  role        user_role NOT NULL DEFAULT 'staff',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── CUSTOMERS ───────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS customer_seq START 1;
CREATE TABLE IF NOT EXISTS customers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_code    TEXT UNIQUE,
  business_name    TEXT NOT NULL,
  contact_person   TEXT,
  address          TEXT,
  phone            TEXT,
  email            TEXT,
  tin              TEXT,
  credit_terms     credit_terms NOT NULL DEFAULT 'CASH',
  credit_limit     NUMERIC(12,2) NOT NULL DEFAULT 0,
  credit_balance   NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_terms_days INT NOT NULL DEFAULT 30,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── CATEGORIES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  code       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── PRODUCTS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku             TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  description     TEXT,
  category_id     UUID REFERENCES categories(id),
  unit_price      NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost_price      NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock_quantity  INT NOT NULL DEFAULT 0,
  reorder_level   INT NOT NULL DEFAULT 5,
  unit            TEXT NOT NULL DEFAULT 'pcs',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── CUSTOMER PRICING ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_pricing (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id)  ON DELETE CASCADE,
  price       NUMERIC(12,2) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(customer_id, product_id)
);

-- ─── ORDERS ──────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS order_seq START 1;
CREATE TABLE IF NOT EXISTS orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number      TEXT UNIQUE,
  customer_id       UUID NOT NULL REFERENCES customers(id),
  status            order_status NOT NULL DEFAULT 'DRAFT',
  payment_method    payment_method NOT NULL DEFAULT 'CASH',
  payment_status    payment_status NOT NULL DEFAULT 'UNPAID',
  subtotal          NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid       NUMERIC(12,2) NOT NULL DEFAULT 0,
  balance_due       NUMERIC(12,2) NOT NULL DEFAULT 0,
  due_date          DATE,
  notes             TEXT,
  created_by        UUID REFERENCES user_profiles(id),
  approved_by       UUID REFERENCES user_profiles(id),
  dispatched_by     UUID REFERENCES user_profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── ORDER ITEMS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id),
  quantity        INT NOT NULL DEFAULT 1,
  unit_price      NUMERIC(12,2) NOT NULL,
  custom_price    BOOLEAN NOT NULL DEFAULT false,
  discount_pct    NUMERIC(5,2) NOT NULL DEFAULT 0,
  subtotal        NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── QUOTATIONS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quotations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  version       INT NOT NULL DEFAULT 1,
  version_label TEXT,
  status        quotation_status NOT NULL DEFAULT 'DRAFT',
  file_url      TEXT,
  notes         TEXT,
  created_by    UUID REFERENCES user_profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── PAYMENTS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       UUID NOT NULL REFERENCES orders(id),
  amount         NUMERIC(12,2) NOT NULL,
  payment_method payment_method NOT NULL,
  reference_no   TEXT,
  notes          TEXT,
  received_by    UUID REFERENCES user_profiles(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── STOCK MOVEMENTS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_movements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID NOT NULL REFERENCES products(id),
  type         stock_movement_type NOT NULL,
  quantity     INT NOT NULL,
  reference    TEXT,
  notes        TEXT,
  created_by   UUID REFERENCES user_profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── DISPATCH CHECKLISTS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS dispatch_checklists (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status       dispatch_status NOT NULL DEFAULT 'READY_FOR_DISPATCH',
  notes        TEXT,
  checked_by   UUID REFERENCES user_profiles(id),
  approved_by  UUID REFERENCES user_profiles(id),
  checked_at   TIMESTAMPTZ,
  approved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dispatch_checklist_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES dispatch_checklists(id) ON DELETE CASCADE,
  product_id   UUID REFERENCES products(id),
  item_name    TEXT NOT NULL,
  quantity     INT NOT NULL DEFAULT 1,
  is_verified  BOOLEAN NOT NULL DEFAULT false,
  notes        TEXT,
  verified_by  UUID REFERENCES user_profiles(id),
  verified_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── AUDIT LOGS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES user_profiles(id),
  action_type TEXT NOT NULL,
  table_name  TEXT,
  record_id   UUID,
  old_data    JSONB,
  new_data    JSONB,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── HELPER FUNCTION ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS user_role AS $$
  SELECT role FROM user_profiles WHERE id = user_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── TRIGGER: Auto-create user_profiles on signup ────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'staff'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── TRIGGER: Auto order number ──────────────────────────────
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.order_number := 'ORD-' || TO_CHAR(NOW(),'YYYYMMDD') || '-' || LPAD(NEXTVAL('order_seq')::TEXT,4,'0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION generate_order_number();

-- ─── TRIGGER: Auto customer code ─────────────────────────────
CREATE OR REPLACE FUNCTION generate_customer_code()
RETURNS TRIGGER AS $$
BEGIN
  NEW.customer_code := 'CUST-' || LPAD(NEXTVAL('customer_seq')::TEXT,5,'0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_customer_code
  BEFORE INSERT ON customers
  FOR EACH ROW EXECUTE FUNCTION generate_customer_code();

-- ─── TRIGGER: updated_at ─────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER upd_user_profiles     BEFORE UPDATE ON user_profiles     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER upd_products          BEFORE UPDATE ON products           FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER upd_orders            BEFORE UPDATE ON orders             FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER upd_customers         BEFORE UPDATE ON customers          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER upd_dispatch          BEFORE UPDATE ON dispatch_checklists FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── TRIGGER: Deduct stock on dispatch ───────────────────────
CREATE OR REPLACE FUNCTION deduct_stock_on_dispatch()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'DISPATCHED' AND OLD.status != 'DISPATCHED' THEN
    UPDATE products p
    SET stock_quantity = stock_quantity - oi.quantity
    FROM order_items oi
    WHERE oi.order_id = NEW.id AND oi.product_id = p.id;

    INSERT INTO stock_movements (product_id, type, quantity, reference, created_by)
    SELECT product_id, 'OUT', quantity, NEW.order_number, NEW.dispatched_by
    FROM order_items WHERE order_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_deduct_stock
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION deduct_stock_on_dispatch();

-- ─── TRIGGER: Set due date on payment terms ──────────────────
CREATE OR REPLACE FUNCTION set_payment_due_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payment_method = 'CASH' THEN
    NEW.due_date := CURRENT_DATE;
  ELSE
    NEW.due_date := CURRENT_DATE + (
      SELECT payment_terms_days FROM customers WHERE id = NEW.customer_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_due_date_on_payment
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION set_payment_due_date();

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────
ALTER TABLE user_profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers               ENABLE ROW LEVEL SECURITY;
ALTER TABLE products                ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_pricing        ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items             ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations              ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments                ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements         ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_checklists     ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories              ENABLE ROW LEVEL SECURITY;

-- user_profiles: everyone can read their own; admin can read all
DROP POLICY IF EXISTS "self_view"     ON user_profiles;
DROP POLICY IF EXISTS "admin_manage"  ON user_profiles;
CREATE POLICY "self_view"    ON user_profiles FOR SELECT USING (auth.uid() = id OR get_user_role(auth.uid()) = 'admin');
CREATE POLICY "admin_manage" ON user_profiles FOR ALL    USING (get_user_role(auth.uid()) = 'admin');

-- All other tables: any authenticated user can SELECT; role-based for mutations
DROP POLICY IF EXISTS "auth_view" ON customers;
CREATE POLICY "auth_view" ON customers FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "auth_manage" ON customers;
CREATE POLICY "auth_manage" ON customers FOR ALL USING (get_user_role(auth.uid()) IN ('admin','owner','staff','accounting'));

DROP POLICY IF EXISTS "auth_view" ON products;
CREATE POLICY "auth_view" ON products FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "auth_manage" ON products;
CREATE POLICY "auth_manage" ON products FOR ALL USING (get_user_role(auth.uid()) IN ('admin','owner','staff','dispatch'));

DROP POLICY IF EXISTS "auth_view" ON orders;
CREATE POLICY "auth_view" ON orders FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "auth_manage" ON orders;
CREATE POLICY "auth_manage" ON orders FOR ALL USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "auth_view" ON order_items;
CREATE POLICY "auth_view" ON order_items FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "auth_manage" ON order_items;
CREATE POLICY "auth_manage" ON order_items FOR ALL USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "auth_view" ON quotations;
CREATE POLICY "auth_view" ON quotations FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "auth_manage" ON quotations;
CREATE POLICY "auth_manage" ON quotations FOR ALL USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "auth_view" ON payments;
CREATE POLICY "auth_view" ON payments FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "auth_manage" ON payments;
CREATE POLICY "auth_manage" ON payments FOR ALL USING (get_user_role(auth.uid()) IN ('admin','accounting','owner'));

DROP POLICY IF EXISTS "auth_view" ON stock_movements;
CREATE POLICY "auth_view" ON stock_movements FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "auth_manage" ON stock_movements;
CREATE POLICY "auth_manage" ON stock_movements FOR ALL USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "auth_view_dispatch" ON dispatch_checklists;
CREATE POLICY "auth_view_dispatch" ON dispatch_checklists FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "dispatch_manage" ON dispatch_checklists;
CREATE POLICY "dispatch_manage" ON dispatch_checklists FOR ALL USING (get_user_role(auth.uid()) IN ('admin','dispatch','owner'));

DROP POLICY IF EXISTS "auth_view_dispatch_items" ON dispatch_checklist_items;
CREATE POLICY "auth_view_dispatch_items" ON dispatch_checklist_items FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "dispatch_manage_items" ON dispatch_checklist_items;
CREATE POLICY "dispatch_manage_items" ON dispatch_checklist_items FOR ALL USING (get_user_role(auth.uid()) IN ('admin','dispatch'));

DROP POLICY IF EXISTS "auth_view" ON audit_logs;
CREATE POLICY "auth_view" ON audit_logs FOR SELECT USING (get_user_role(auth.uid()) IN ('admin','owner'));
DROP POLICY IF EXISTS "auth_insert" ON audit_logs;
CREATE POLICY "auth_insert" ON audit_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "auth_view" ON categories;
CREATE POLICY "auth_view" ON categories FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "admin_manage" ON categories;
CREATE POLICY "admin_manage" ON categories FOR ALL USING (get_user_role(auth.uid()) IN ('admin','owner'));

DROP POLICY IF EXISTS "auth_view" ON customer_pricing;
CREATE POLICY "auth_view" ON customer_pricing FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "auth_manage" ON customer_pricing;
CREATE POLICY "auth_manage" ON customer_pricing FOR ALL USING (get_user_role(auth.uid()) IN ('admin','owner','accounting'));

-- ─── REALTIME ─────────────────────────────────────────────────
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE orders;
  ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
  ALTER PUBLICATION supabase_realtime ADD TABLE products;
  ALTER PUBLICATION supabase_realtime ADD TABLE payments;
  ALTER PUBLICATION supabase_realtime ADD TABLE customers;
  ALTER PUBLICATION supabase_realtime ADD TABLE quotations;
  ALTER PUBLICATION supabase_realtime ADD TABLE stock_movements;
  ALTER PUBLICATION supabase_realtime ADD TABLE dispatch_checklists;
  ALTER PUBLICATION supabase_realtime ADD TABLE dispatch_checklist_items;
EXCEPTION WHEN OTHERS THEN
  -- Tables may already be in the publication, ignore
  NULL;
END $$;

-- ─── SEED: Categories ────────────────────────────────────────
INSERT INTO categories (name, code) VALUES
  ('Engine Parts',   'ENG'),
  ('Oils & Lubricants', 'OIL'),
  ('Brake System',   'BRK'),
  ('Electrical',     'ELC'),
  ('Body Parts',     'BDY'),
  ('Transmission',   'TRX'),
  ('Filters',        'FLT'),
  ('Accessories',    'ACC')
ON CONFLICT (code) DO NOTHING;

-- ─── SEED: Users ─────────────────────────────────────────────
-- Insert into auth.users with hashed passwords

DO $$
DECLARE
  uid_admin      UUID := 'a1000000-0000-0000-0000-000000000001';
  uid_owner      UUID := 'a2000000-0000-0000-0000-000000000002';
  uid_accounting UUID := 'a3000000-0000-0000-0000-000000000003';
  uid_staff      UUID := 'a4000000-0000-0000-0000-000000000004';
  uid_dispatch   UUID := 'a5000000-0000-0000-0000-000000000005';
BEGIN
  INSERT INTO auth.users (id,instance_id,email,encrypted_password,email_confirmed_at,role,aud,raw_user_meta_data,raw_app_meta_data,created_at,updated_at,confirmation_token,recovery_token)
  VALUES
    (uid_admin,      '00000000-0000-0000-0000-000000000000','admin@aclc.com',      crypt('Admin@ACLC2025!',     gen_salt('bf',10)),now(),'authenticated','authenticated','{"full_name":"ACLC Administrator"}','{"provider":"email","providers":["email"]}',now(),now(),'',''),
    (uid_owner,      '00000000-0000-0000-0000-000000000000','owner@aclc.com',      crypt('Owner@ACLC2025!',     gen_salt('bf',10)),now(),'authenticated','authenticated','{"full_name":"ACLC Owner"}',         '{"provider":"email","providers":["email"]}',now(),now(),'',''),
    (uid_accounting, '00000000-0000-0000-0000-000000000000','accounting@aclc.com', crypt('Acct@ACLC2025!',      gen_salt('bf',10)),now(),'authenticated','authenticated','{"full_name":"ACLC Accounting"}',    '{"provider":"email","providers":["email"]}',now(),now(),'',''),
    (uid_staff,      '00000000-0000-0000-0000-000000000000','staff@aclc.com',      crypt('Staff@ACLC2025!',     gen_salt('bf',10)),now(),'authenticated','authenticated','{"full_name":"ACLC Staff"}',         '{"provider":"email","providers":["email"]}',now(),now(),'',''),
    (uid_dispatch,   '00000000-0000-0000-0000-000000000000','dispatch@aclc.com',   crypt('Dispatch@ACLC2025!',  gen_salt('bf',10)),now(),'authenticated','authenticated','{"full_name":"ACLC Dispatch"}',      '{"provider":"email","providers":["email"]}',now(),now(),'','')
  ON CONFLICT (id) DO NOTHING;
END $$;

-- ─── SEED: Identities (required by newer Supabase) ───────────
INSERT INTO auth.identities (id,user_id,provider_id,provider,identity_data,created_at,updated_at,last_sign_in_at)
SELECT gen_random_uuid(), id, email, 'email',
       json_build_object('sub', id::text, 'email', email),
       now(), now(), now()
FROM auth.users
WHERE email IN ('admin@aclc.com','owner@aclc.com','accounting@aclc.com','staff@aclc.com','dispatch@aclc.com')
ON CONFLICT DO NOTHING;

-- ─── SEED: user_profiles (set correct roles) ─────────────────
INSERT INTO user_profiles (id, email, full_name, role, is_active)
VALUES
  ('a1000000-0000-0000-0000-000000000001','admin@aclc.com',      'ACLC Administrator','admin',      true),
  ('a2000000-0000-0000-0000-000000000002','owner@aclc.com',      'ACLC Owner',        'owner',      true),
  ('a3000000-0000-0000-0000-000000000003','accounting@aclc.com', 'ACLC Accounting',   'accounting', true),
  ('a4000000-0000-0000-0000-000000000004','staff@aclc.com',      'ACLC Staff',        'staff',      true),
  ('a5000000-0000-0000-0000-000000000005','dispatch@aclc.com',   'ACLC Dispatch',     'dispatch',   true)
ON CONFLICT (id) DO UPDATE SET
  role      = EXCLUDED.role,
  full_name = EXCLUDED.full_name,
  is_active = true;

-- ─── VERIFY (will show at bottom of results) ─────────────────
SELECT u.email, p.full_name, p.role,
       u.email_confirmed_at IS NOT NULL AS confirmed
FROM auth.users u
JOIN user_profiles p ON p.id = u.id
WHERE u.email LIKE '%@aclc.com'
ORDER BY p.role;
