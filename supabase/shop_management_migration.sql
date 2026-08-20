-- ============================================================
-- ACLC WMS — Shop/Customer Management Migration
-- Run this ONCE in your Supabase SQL Editor (safe, additive)
-- Existing data is NOT deleted or modified
-- ============================================================

-- ─── STEP 1: Extend customers table ─────────────────────────
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS contact_number  TEXT,
  ADD COLUMN IF NOT EXISTS agent_id        UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS notes           TEXT,
  ADD COLUMN IF NOT EXISTS updated_by      UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS shop_code       TEXT;

-- Sync phone → contact_number for existing rows if phone column exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='phone') THEN
    UPDATE customers SET contact_number = phone WHERE contact_number IS NULL AND phone IS NOT NULL;
  END IF;
END $$;

-- ─── STEP 2: Extend order_items with price snapshot columns ──
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS regular_price_snapshot  NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS shop_price_snapshot     NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS price_source            TEXT NOT NULL DEFAULT 'REGULAR',
  ADD COLUMN IF NOT EXISTS manual_reason           TEXT,
  ADD COLUMN IF NOT EXISTS discount_amount         NUMERIC(12,2) NOT NULL DEFAULT 0;

-- ─── STEP 3: Extend orders with payment terms snapshot ───────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_terms_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS credit_terms_snapshot  TEXT;

-- ─── STEP 4: Create shop_pricing table (versioned) ───────────
CREATE TABLE IF NOT EXISTS shop_pricing (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id        UUID        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id     UUID        NOT NULL REFERENCES products(id)  ON DELETE CASCADE,
  regular_price  NUMERIC(12,2) NOT NULL,
  special_price  NUMERIC(12,2) NOT NULL,
  effective_date DATE        NOT NULL DEFAULT CURRENT_DATE,
  is_active      BOOLEAN     NOT NULL DEFAULT true,
  reason         TEXT,
  created_by     UUID        REFERENCES user_profiles(id),
  updated_by     UUID        REFERENCES user_profiles(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shop_pricing_one_active
  ON shop_pricing(shop_id, product_id)
  WHERE is_active = true;

DROP TRIGGER IF EXISTS upd_shop_pricing ON shop_pricing;
CREATE TRIGGER upd_shop_pricing
  BEFORE UPDATE ON shop_pricing
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── STEP 5: Create shop_pricing_history table ───────────────
CREATE TABLE IF NOT EXISTS shop_pricing_history (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id        UUID        NOT NULL REFERENCES customers(id),
  product_id     UUID        NOT NULL REFERENCES products(id),
  previous_price NUMERIC(12,2),
  new_price      NUMERIC(12,2) NOT NULL,
  effective_date DATE        NOT NULL,
  changed_by     UUID        REFERENCES user_profiles(id),
  reason         TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── STEP 6: Migrate existing customer_pricing → shop_pricing ─
DO $$
BEGIN
  -- Only run if customer_pricing table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customer_pricing') THEN
    INSERT INTO shop_pricing (
      shop_id, product_id, regular_price, special_price,
      effective_date, is_active, created_by, created_at, updated_at
    )
    SELECT
      cp.customer_id,
      cp.product_id,
      p.unit_price,
      COALESCE(cp.custom_price, p.unit_price),
      CURRENT_DATE,
      true,
      cp.created_by,
      cp.created_at,
      COALESCE(cp.updated_at, cp.created_at)
    FROM customer_pricing cp
    JOIN products p ON p.id = cp.product_id
    ON CONFLICT DO NOTHING;
  END IF;
END $$;


-- ─── STEP 7: Enable RLS ───────────────────────────────────────
ALTER TABLE shop_pricing         ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_pricing_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shop_pricing_view"   ON shop_pricing;
DROP POLICY IF EXISTS "shop_pricing_manage" ON shop_pricing;
CREATE POLICY "shop_pricing_view"   ON shop_pricing FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "shop_pricing_manage" ON shop_pricing FOR ALL
  USING (get_user_role(auth.uid()) IN ('admin','owner','staff','accounting'));

DROP POLICY IF EXISTS "shop_pricing_history_view"   ON shop_pricing_history;
DROP POLICY IF EXISTS "shop_pricing_history_insert" ON shop_pricing_history;
CREATE POLICY "shop_pricing_history_view"   ON shop_pricing_history FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "shop_pricing_history_insert" ON shop_pricing_history FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ─── STEP 8: Realtime ─────────────────────────────────────────
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE shop_pricing;
  ALTER PUBLICATION supabase_realtime ADD TABLE shop_pricing_history;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ─── STEP 9: Helper functions ─────────────────────────────────

-- Returns the active special price for a shop+product, NULL if none
CREATE OR REPLACE FUNCTION get_shop_price(p_shop_id UUID, p_product_id UUID)
RETURNS NUMERIC AS $$
  SELECT special_price
  FROM shop_pricing
  WHERE shop_id       = p_shop_id
    AND product_id    = p_product_id
    AND is_active     = true
    AND effective_date <= CURRENT_DATE
  ORDER BY effective_date DESC
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Returns the most recent unit_price used for this shop+product in a non-cancelled order
CREATE OR REPLACE FUNCTION get_last_shop_order_price(p_shop_id UUID, p_product_id UUID)
RETURNS NUMERIC AS $$
  SELECT oi.unit_price
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE o.customer_id = p_shop_id
    AND oi.product_id = p_product_id
    AND o.status NOT IN ('CANCELLED')
  ORDER BY o.created_at DESC
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── VERIFICATION ─────────────────────────────────────────────
SELECT 'shop_pricing'         AS table_name, COUNT(*) AS rows FROM shop_pricing
UNION ALL
SELECT 'shop_pricing_history' AS table_name, COUNT(*) AS rows FROM shop_pricing_history
UNION ALL
SELECT 'customers'            AS table_name, COUNT(*) AS rows FROM customers
UNION ALL
SELECT 'order_items'          AS table_name, COUNT(*) AS rows FROM order_items;
