-- ============================================================
-- ACLC WMS — SEED DATA (Realistic Motorcycle Parts)
-- Run AFTER fresh_setup.sql + shop_management_migration.sql
-- ⚠️  Requires at least ONE user_profile in the DB first.
--     The script grabs the first admin/owner user as created_by.
-- ============================================================

DO $$
DECLARE
  v_user        UUID;

  -- Category IDs
  c_engine      UUID := gen_random_uuid();
  c_brake       UUID := gen_random_uuid();
  c_suspension  UUID := gen_random_uuid();
  c_electrical  UUID := gen_random_uuid();
  c_body        UUID := gen_random_uuid();
  c_drivetrain  UUID := gen_random_uuid();
  c_filter      UUID := gen_random_uuid();
  c_lighting    UUID := gen_random_uuid();

  -- Product IDs (engine)
  p_piston_50   UUID := gen_random_uuid();
  p_piston_125  UUID := gen_random_uuid();
  p_piston_150  UUID := gen_random_uuid();
  p_ringset_50  UUID := gen_random_uuid();
  p_ringset_125 UUID := gen_random_uuid();
  p_ringset_150 UUID := gen_random_uuid();
  p_gasket_50   UUID := gen_random_uuid();
  p_gasket_125  UUID := gen_random_uuid();
  p_gasket_150  UUID := gen_random_uuid();
  p_crank_125   UUID := gen_random_uuid();
  p_crank_150   UUID := gen_random_uuid();
  p_cam_125     UUID := gen_random_uuid();
  p_rocker_125  UUID := gen_random_uuid();
  p_valve_in    UUID := gen_random_uuid();
  p_valve_ex    UUID := gen_random_uuid();

  -- Product IDs (brake)
  p_brake_pad_f UUID := gen_random_uuid();
  p_brake_pad_r UUID := gen_random_uuid();
  p_brake_shoe  UUID := gen_random_uuid();
  p_brake_disc  UUID := gen_random_uuid();
  p_brake_cable UUID := gen_random_uuid();

  -- Product IDs (suspension)
  p_fork_seal   UUID := gen_random_uuid();
  p_shock_abs   UUID := gen_random_uuid();
  p_fork_spring UUID := gen_random_uuid();

  -- Product IDs (electrical)
  p_cdi_unit    UUID := gen_random_uuid();
  p_magneto     UUID := gen_random_uuid();
  p_rectifier   UUID := gen_random_uuid();
  p_spark_ng    UUID := gen_random_uuid();
  p_spark_irid  UUID := gen_random_uuid();
  p_batt_ytx5   UUID := gen_random_uuid();
  p_batt_ytx12  UUID := gen_random_uuid();
  p_starter_mot UUID := gen_random_uuid();

  -- Product IDs (body)
  p_fairng_l    UUID := gen_random_uuid();
  p_fairng_r    UUID := gen_random_uuid();
  p_fender_f    UUID := gen_random_uuid();
  p_fender_r    UUID := gen_random_uuid();
  p_side_cover  UUID := gen_random_uuid();
  p_fuel_tank   UUID := gen_random_uuid();
  p_seat_assy   UUID := gen_random_uuid();

  -- Product IDs (drivetrain)
  p_chain_428   UUID := gen_random_uuid();
  p_chain_520   UUID := gen_random_uuid();
  p_sprocket_f  UUID := gen_random_uuid();
  p_sprocket_r  UUID := gen_random_uuid();
  p_clutch_disc UUID := gen_random_uuid();
  p_clutch_spr  UUID := gen_random_uuid();
  p_clutch_plate UUID := gen_random_uuid();

  -- Product IDs (filter)
  p_air_filter  UUID := gen_random_uuid();
  p_oil_filter  UUID := gen_random_uuid();
  p_fuel_filter UUID := gen_random_uuid();

  -- Product IDs (lighting)
  p_headlight   UUID := gen_random_uuid();
  p_led_head    UUID := gen_random_uuid();
  p_taillight   UUID := gen_random_uuid();
  p_turn_sig    UUID := gen_random_uuid();

  -- Customer IDs
  k_bagong      UUID := gen_random_uuid();
  k_santos      UUID := gen_random_uuid();
  k_rizal       UUID := gen_random_uuid();
  k_mabini      UUID := gen_random_uuid();
  k_luna        UUID := gen_random_uuid();
  k_boni        UUID := gen_random_uuid();
  k_magsaysay   UUID := gen_random_uuid();
  k_quezon      UUID := gen_random_uuid();
  k_macapagal   UUID := gen_random_uuid();
  k_abad        UUID := gen_random_uuid();
  k_del_pilar   UUID := gen_random_uuid();
  k_aguinaldo   UUID := gen_random_uuid();

  -- Order IDs
  o1  UUID := gen_random_uuid();
  o2  UUID := gen_random_uuid();
  o3  UUID := gen_random_uuid();
  o4  UUID := gen_random_uuid();
  o5  UUID := gen_random_uuid();
  o6  UUID := gen_random_uuid();
  o7  UUID := gen_random_uuid();
  o8  UUID := gen_random_uuid();
  o9  UUID := gen_random_uuid();
  o10 UUID := gen_random_uuid();
  o11 UUID := gen_random_uuid();
  o12 UUID := gen_random_uuid();
  o13 UUID := gen_random_uuid();
  o14 UUID := gen_random_uuid();
  o15 UUID := gen_random_uuid();

BEGIN

  -- ── Get first available user ─────────────────────────────────
  SELECT id INTO v_user FROM user_profiles ORDER BY created_at LIMIT 1;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No user_profiles found. Please sign up and log in first, then run this script.';
  END IF;

  -- ─────────────────────────────────────────────────────────────
  -- CATEGORIES
  -- ─────────────────────────────────────────────────────────────
  INSERT INTO categories (id, name, code) VALUES
    (c_engine,     'Engine Parts',        'ENG'),
    (c_brake,      'Brake System',        'BRK'),
    (c_suspension, 'Suspension & Steering','SUS'),
    (c_electrical, 'Electrical & Ignition','ELC'),
    (c_body,       'Body & Frame Parts',  'BDY'),
    (c_drivetrain, 'Drivetrain & Clutch', 'DRV'),
    (c_filter,     'Filters & Fluids',    'FLT'),
    (c_lighting,   'Lighting & Bulbs',    'LGT')
  ON CONFLICT DO NOTHING;

  -- ─────────────────────────────────────────────────────────────
  -- PRODUCTS  (sku, name, category, unit_price, stock, reorder, unit)
  -- ─────────────────────────────────────────────────────────────

  -- ENGINE PARTS
  INSERT INTO products (id, sku, name, description, category_id, unit_price, stock_quantity, reorder_level, unit_of_measure) VALUES
    (p_piston_50,  'ENG-PST-050', 'Piston Kit 50cc (STD)',        'Standard bore piston assembly for 50cc scooter engines. Includes pin and clips.',       c_engine, 285.00,  120, 20, 'set'),
    (p_piston_125, 'ENG-PST-125', 'Piston Kit 125cc (STD)',       'Standard bore piston for Honda Wave/Yamaha Sniper 125cc. Includes piston pin.',          c_engine, 420.00,  200, 30, 'set'),
    (p_piston_150, 'ENG-PST-150', 'Piston Kit 150cc (STD)',       'Standard bore piston for Yamaha Mio/Nmax/Honda Click 150. OEM-quality casting.',         c_engine, 650.00,  150, 25, 'set'),
    (p_ringset_50,  'ENG-RNG-050', 'Piston Ring Set 50cc',        'Chrome-faced compression rings for 50cc engines. Set of 3.',                              c_engine, 95.00,   180, 25, 'set'),
    (p_ringset_125, 'ENG-RNG-125', 'Piston Ring Set 125cc',       'Standard ring set for Wave/XRM/Barako 125cc engines.',                                    c_engine, 145.00,  220, 35, 'set'),
    (p_ringset_150, 'ENG-RNG-150', 'Piston Ring Set 150cc',       'Ring set for Nmax/PCX/Click 150. Includes oil control ring.',                             c_engine, 210.00,  160, 25, 'set'),
    (p_gasket_50,   'ENG-GSK-050', 'Full Gasket Set 50cc',        'Complete engine gasket kit for 50cc scooters. Head, base, and side cover gaskets.',       c_engine, 155.00,  100, 15, 'set'),
    (p_gasket_125,  'ENG-GSK-125', 'Full Gasket Set 125cc',       'Complete gasket set for 125cc wave-type engines including valve stem seals.',             c_engine, 245.00,  130, 20, 'set'),
    (p_gasket_150,  'ENG-GSK-150', 'Full Gasket Set 150cc',       'Full gasket kit for 150cc underbone and scooter engines.',                                c_engine, 380.00,  90,  15, 'set'),
    (p_crank_125,   'ENG-CRK-125', 'Crankshaft Assembly 125cc',   'Rebuildable crankshaft with connecting rod for Honda Wave/XRM 125. Balanced.',            c_engine, 1850.00, 40, 5,  'pc'),
    (p_crank_150,   'ENG-CRK-150', 'Crankshaft Assembly 150cc',   'Complete crankshaft for Yamaha Nmax/Aerox 155 with balancer weight.',                     c_engine, 2750.00, 20, 5,  'pc'),
    (p_cam_125,     'ENG-CAM-125', 'Camshaft 125cc',              'OEM-spec camshaft for Wave-type 125cc engines. Includes decompressor pin.',               c_engine, 680.00,  55, 8,  'pc'),
    (p_rocker_125,  'ENG-RCK-125', 'Rocker Arm Set 125cc',        'Intake and exhaust rocker arms for 125cc engines. Sold as a pair.',                       c_engine, 320.00,  70, 10, 'set'),
    (p_valve_in,    'ENG-VLV-INT', 'Intake Valve (Universal)',     'Chrome-coated intake valve for 125–150cc engines. Diameter: 23mm.',                      c_engine, 85.00,   200, 30, 'pc'),
    (p_valve_ex,    'ENG-VLV-EXT', 'Exhaust Valve (Universal)',    'Hardened steel exhaust valve for 125–150cc engines. High-heat resistant.',                c_engine, 95.00,   200, 30, 'pc')
  ON CONFLICT DO NOTHING;

  -- BRAKE SYSTEM
  INSERT INTO products (id, sku, name, description, category_id, unit_price, stock_quantity, reorder_level, unit_of_measure) VALUES
    (p_brake_pad_f,'BRK-PAD-F',   'Front Brake Pad (Disc)',       'Sintered semi-metallic front brake pad for disc-type motorcycles. Low dust.',             c_brake,  145.00, 250, 40, 'set'),
    (p_brake_pad_r,'BRK-PAD-R',   'Rear Brake Pad (Disc)',        'Organic rear brake pad for disc brakes. Compatible with Click, PCX, Nmax.',               c_brake,  125.00, 220, 40, 'set'),
    (p_brake_shoe, 'BRK-SHO-DR',  'Brake Shoe Set (Drum)',        'Standard drum brake shoe set for underbone motorcycles. Includes spring.',                 c_brake,  85.00,  300, 50, 'set'),
    (p_brake_disc, 'BRK-DSC-250', 'Brake Disc Rotor 250mm',       'Stainless steel wavy disc rotor 250mm for most 125–150cc scooters.',                      c_brake,  650.00, 80,  10, 'pc'),
    (p_brake_cable,'BRK-CBL-UNV', 'Brake Cable (Universal)',      'Universal throttle/rear brake cable. Adjustable length 80–120cm.',                        c_brake,  55.00,  350, 60, 'pc')
  ON CONFLICT DO NOTHING;

  -- SUSPENSION
  INSERT INTO products (id, sku, name, description, category_id, unit_price, stock_quantity, reorder_level, unit_of_measure) VALUES
    (p_fork_seal,  'SUS-FSL-33MM','Fork Seal 33mm',               'Oil seal for 33mm front fork tubes. Pair. Fits most 125cc underbones.',                   c_suspension, 120.00, 160, 25, 'pair'),
    (p_shock_abs,  'SUS-SHK-REAR','Rear Shock Absorber (Pair)',   'Heavy-duty rear shock set with adjustable preload. Universal fit for 125–155cc.',          c_suspension, 950.00, 60,  8,  'pair'),
    (p_fork_spring,'SUS-FSP-UNV', 'Fork Spring (Pair)',           'Progressive rate front fork springs for Wave/XRM type motorcycles.',                       c_suspension, 380.00, 80,  10, 'pair')
  ON CONFLICT DO NOTHING;

  -- ELECTRICAL
  INSERT INTO products (id, sku, name, description, category_id, unit_price, stock_quantity, reorder_level, unit_of_measure) VALUES
    (p_cdi_unit,   'ELC-CDI-125', 'CDI Unit 125cc (AC)',          'Unlocked AC CDI for Wave/XRM/Barako 125. No rev limiter. 6-pin connector.',               c_electrical, 320.00,  90,  15, 'pc'),
    (p_magneto,    'ELC-MAG-125', 'Magneto / Flywheel Assy 125cc','Complete magneto stator assembly with flywheel. OEM replacement for Honda 125cc.',         c_electrical, 1100.00, 30,  5,  'set'),
    (p_rectifier,  'ELC-REC-UNV', 'Rectifier / Regulator',       'Universal 12V rectifier regulator for AC motorcycles. 6-wire type.',                       c_electrical, 185.00,  120, 20, 'pc'),
    (p_spark_ng,   'ELC-SPK-NGK', 'Spark Plug NGK CR8EH-9',       'Standard nickel spark plug NGK CR8EH-9. Fits Honda Wave, Yamaha Mio.',                     c_electrical, 95.00,   500, 80, 'pc'),
    (p_spark_irid, 'ELC-SPK-IRD', 'Spark Plug Iridium CR8EHIX-9', 'Iridium-tipped plug for better fuel economy and performance. Long life (30,000km).',       c_electrical, 285.00,  180, 30, 'pc'),
    (p_batt_ytx5,  'ELC-BAT-YTX5','Battery YTX5L-BS 12V 5Ah',    'Maintenance-free AGM battery 12V 5Ah. For 110–125cc scooters and underbones.',             c_electrical, 650.00,  75,  12, 'pc'),
    (p_batt_ytx12, 'ELC-BAT-YT12','Battery YTZ12S 12V 11Ah',     'MF AGM battery 12V 11Ah for Nmax, PCX, ADV 150. OEM equivalent.',                         c_electrical, 1450.00, 40,  6,  'pc'),
    (p_starter_mot,'ELC-STR-125', 'Starter Motor 125cc',          'Electric starter motor for 125cc wave-type engines. Rebuilt unit.',                        c_electrical, 780.00,  35,  5,  'pc')
  ON CONFLICT DO NOTHING;

  -- BODY
  INSERT INTO products (id, sku, name, description, category_id, unit_price, stock_quantity, reorder_level, unit_of_measure) VALUES
    (p_fairng_l,   'BDY-FAR-L',   'Left Side Fairing (Generic)',  'Left body panel for 125cc scooters. ABS plastic, unpainted. Universal fit.',               c_body, 420.00,  45, 8,  'pc'),
    (p_fairng_r,   'BDY-FAR-R',   'Right Side Fairing (Generic)', 'Right body panel. ABS plastic, unpainted. Fits most Beat/Mio type scooters.',              c_body, 420.00,  45, 8,  'pc'),
    (p_fender_f,   'BDY-FND-F',   'Front Fender (Universal)',     'Unpainted front fender for underbone motorcycles. PP plastic.',                            c_body, 280.00,  60, 10, 'pc'),
    (p_fender_r,   'BDY-FND-R',   'Rear Fender (Universal)',      'Rear fender assembly with reflector hole. Fits Wave/XRM type.',                            c_body, 310.00,  55, 10, 'pc'),
    (p_side_cover, 'BDY-SCV-125', 'Side Cover 125cc (Pair)',      'Left and right engine side covers. Painted black. Wave-type compatible.',                   c_body, 380.00,  50, 8,  'pair'),
    (p_fuel_tank,  'BDY-TNK-125', 'Fuel Tank 125cc',              'Replacement fuel tank with petcock. 4.5L capacity. Fits Honda Wave 125.',                  c_body, 1850.00, 15, 3,  'pc'),
    (p_seat_assy,  'BDY-STA-125', 'Seat Assembly 125cc',          'Replacement saddle seat with foam padding and latch. Wave-type underbones.',               c_body, 780.00,  25, 5,  'pc')
  ON CONFLICT DO NOTHING;

  -- DRIVETRAIN
  INSERT INTO products (id, sku, name, description, category_id, unit_price, stock_quantity, reorder_level, unit_of_measure) VALUES
    (p_chain_428,  'DRV-CHN-428', 'Drive Chain 428H x 120L',     'Heavy-duty 428H drive chain 120 links. Fits most 100–125cc motorcycles.',                  c_drivetrain, 185.00, 200, 35, 'pc'),
    (p_chain_520,  'DRV-CHN-520', 'Drive Chain 520 x 110L',      'O-ring chain 520 size 110 links for 150–200cc motorcycles.',                               c_drivetrain, 680.00, 80,  15, 'pc'),
    (p_sprocket_f, 'DRV-SPR-F14', 'Front Sprocket 14T',          'Front drive sprocket 14-tooth. Fits XRM/Wave 125 with 428 chain.',                         c_drivetrain, 95.00,  180, 30, 'pc'),
    (p_sprocket_r, 'DRV-SPR-R39', 'Rear Sprocket 39T',           'Rear driven sprocket 39-tooth for 428 chain. Chromoly steel.',                             c_drivetrain, 185.00, 160, 25, 'pc'),
    (p_clutch_disc,'DRV-CLT-DSC', 'Clutch Friction Disc Set',    'Set of 4 friction discs for manual clutch 125–150cc. OEM thickness.',                      c_drivetrain, 245.00, 120, 20, 'set'),
    (p_clutch_spr, 'DRV-CLT-SPR', 'Clutch Spring Set',           'Set of 6 clutch springs for wave-type 125cc. Standard tension.',                           c_drivetrain, 85.00,  200, 35, 'set'),
    (p_clutch_plate,'DRV-CLT-PLT','Clutch Steel Plate Set',      'Set of 3 steel separator plates for wet clutch. Fits Wave/XRM.',                           c_drivetrain, 120.00, 150, 25, 'set')
  ON CONFLICT DO NOTHING;

  -- FILTERS
  INSERT INTO products (id, sku, name, description, category_id, unit_price, stock_quantity, reorder_level, unit_of_measure) VALUES
    (p_air_filter, 'FLT-AIR-UNV', 'Air Filter Element (Universal)','Foam/cotton gauze air filter. 35–38mm inlet. Washable and reusable.',                     c_filter, 65.00, 400, 60, 'pc'),
    (p_oil_filter, 'FLT-OIL-UNV', 'Oil Filter (Centrifugal Cov.)', 'Oil filter cover/strainer for scooters with centrifugal oil filtration system.',           c_filter, 45.00, 350, 60, 'pc'),
    (p_fuel_filter,'FLT-FUL-UNV', 'Inline Fuel Filter',           'Universal inline fuel filter with glass bowl. 6mm–8mm hose barb.',                         c_filter, 35.00, 500, 80, 'pc')
  ON CONFLICT DO NOTHING;

  -- LIGHTING
  INSERT INTO products (id, sku, name, description, category_id, unit_price, stock_quantity, reorder_level, unit_of_measure) VALUES
    (p_headlight,  'LGT-HDL-H4',  'H4 Headlight Bulb 35/35W',    'Standard H4 halogen headlight bulb 12V 35/35W. Hi-Lo beam.',                               c_lighting, 85.00,  300, 50, 'pc'),
    (p_led_head,   'LGT-LED-H4',  'LED Headlight H4 Conversion',  'LED H4 conversion kit 6000K white. 25W equivalent to 55W halogen. IP68 waterproof.',       c_lighting, 385.00, 120, 20, 'set'),
    (p_taillight,  'LGT-TLL-LED', 'LED Tail Light Assembly',      'LED tail/brake light assembly with integrated stop light. Universal mount.',                c_lighting, 245.00, 90,  15, 'pc'),
    (p_turn_sig,   'LGT-TRN-LED', 'LED Turn Signal Set (4pcs)',   'Amber LED turn signal lights with chrome housing. Set of 4. Universal mount.',             c_lighting, 185.00, 110, 18, 'set')
  ON CONFLICT DO NOTHING;

  -- ─────────────────────────────────────────────────────────────
  -- CUSTOMERS / SHOPS
  -- ─────────────────────────────────────────────────────────────
  INSERT INTO customers (id, business_name, contact_person, contact_number, address, tin, credit_terms, credit_limit, is_active, notes, created_by, created_at) VALUES
    (k_bagong,    'Bagong Ilaw Motor Shop',     'Rogelio Dela Cruz',   '09171234001', 'Blk 4 Lot 12 Bagong Ilaw Subd., Sta. Rosa, Laguna',           '123-456-789-000', 'TERMS',            50000.00, true,  'Loyal customer since 2019. Prefers bulk orders on engine parts. Pays on 55th day.',           v_user, now() - interval '2 years'),
    (k_santos,    'Santos Motor Parts & Acc.',  'Maria Santos',        '09181234002', '123 Rizal Ave., Calamba City, Laguna',                        '234-567-890-000', 'CASH',             0.00,     true,  'Walk-in customer upgraded to account. Specializes in scooter accessories.',                   v_user, now() - interval '18 months'),
    (k_rizal,     'Rizal Motor Center',         'Eduardo Rizal Jr.',   '09191234003', '456 Gen. Trias Dr., Imus, Cavite',                            '345-678-901-000', 'POST_DATED_CHECK', 75000.00, true,  'Issues PDC every 1st of the month. Credit limit strictly enforced.',                          v_user, now() - interval '3 years'),
    (k_mabini,    'Mabini Motors & Trading',    'Ernesto Mabini',      '09201234004', '789 Mabini St., Dasmariñas, Cavite',                          '456-789-012-000', 'TERMS',            80000.00, true,  'High-volume buyer for Honda Wave parts. Gets 5% special pricing on engine and drivetrain.',   v_user, now() - interval '4 years'),
    (k_luna,      'Luna Auto & Motor Supply',   'Liza Luna',           '09211234005', 'Unit 5, Traders Hub Bldg., Biñan City, Laguna',               '567-890-123-000', 'CASH',             0.00,     true,  'Focuses on electrical parts. Fast-moving account — pays same day.',                          v_user, now() - interval '1 year'),
    (k_boni,      'Boni Parts & Accessories',   'Ramon Bonifacio',     '09221234006', '#22 Bonifacio St., San Pedro, Laguna',                        '678-901-234-000', 'TERMS',            60000.00, true,  'Regular orders every 2 weeks. Good payment record.',                                          v_user, now() - interval '2 years 3 months'),
    (k_magsaysay, 'Magsaysay Motor Repair',     'Jun Magsaysay',       '09231234007', '34 Magsaysay Ave., Bacoor, Cavite',                           '789-012-345-000', 'CASH',             0.00,     true,  'Repair shop. Orders mostly gaskets, rings, and brake parts per repair job.',                  v_user, now() - interval '8 months'),
    (k_quezon,    'Quezon Motor Shop',          'Angelina Quezon',     '09241234008', '567 Quezon Blvd., Lucena City, Quezon',                       '890-123-456-000', 'POST_DATED_CHECK', 100000.00, true,  'Large account. Orders once a month in bulk. PDC issued 30 days prior.',                      v_user, now() - interval '5 years'),
    (k_macapagal, 'Macapagal Motor Supply',     'Victor Macapagal',    '09251234009', '89 Macapagal Ave., Parañaque City, Metro Manila',             '901-234-567-000', 'TERMS',            120000.00, true,  'Metro Manila distributor. High-value orders. Gets special pricing on almost all products.',   v_user, now() - interval '6 years'),
    (k_abad,      'Abad Motor Accessories',     'Cecilia Abad',        '09261234010', '#3 Abad St., General Santos City, South Cotabato',            '012-345-678-000', 'CASH',             0.00,     true,  'Province account. Orders shipped via freight. All cash basis.',                               v_user, now() - interval '14 months'),
    (k_del_pilar, 'Del Pilar Motorsports',      'Ferdinand Del Pilar', '09271234011', '156 Del Pilar St., San Fernando, Pampanga',                   '112-233-445-000', 'TERMS',            45000.00, false, 'Account temporarily inactive. Owner currently abroad. Resume expected Q1 2026.',              v_user, now() - interval '3 years'),
    (k_aguinaldo, 'Aguinaldo Bike & Parts',     'Emilio Aguinaldo Jr.','09281234012', 'Km. 40 Emilio Aguinaldo Hwy., Kawit, Cavite',                 '223-344-556-000', 'TERMS',            90000.00, true,  'Sports bike focus. Orders suspension, brakes, and lighting heavily. Technical buyer.',        v_user, now() - interval '2 years 7 months')
  ON CONFLICT DO NOTHING;

  -- Update customer codes manually (trigger may not fire for direct inserts)
  UPDATE customers SET customer_code = 'CUST-0001' WHERE id = k_bagong    AND customer_code IS NULL;
  UPDATE customers SET customer_code = 'CUST-0002' WHERE id = k_santos    AND customer_code IS NULL;
  UPDATE customers SET customer_code = 'CUST-0003' WHERE id = k_rizal     AND customer_code IS NULL;
  UPDATE customers SET customer_code = 'CUST-0004' WHERE id = k_mabini    AND customer_code IS NULL;
  UPDATE customers SET customer_code = 'CUST-0005' WHERE id = k_luna      AND customer_code IS NULL;
  UPDATE customers SET customer_code = 'CUST-0006' WHERE id = k_boni      AND customer_code IS NULL;
  UPDATE customers SET customer_code = 'CUST-0007' WHERE id = k_magsaysay AND customer_code IS NULL;
  UPDATE customers SET customer_code = 'CUST-0008' WHERE id = k_quezon    AND customer_code IS NULL;
  UPDATE customers SET customer_code = 'CUST-0009' WHERE id = k_macapagal AND customer_code IS NULL;
  UPDATE customers SET customer_code = 'CUST-0010' WHERE id = k_abad      AND customer_code IS NULL;
  UPDATE customers SET customer_code = 'CUST-0011' WHERE id = k_del_pilar AND customer_code IS NULL;
  UPDATE customers SET customer_code = 'CUST-0012' WHERE id = k_aguinaldo AND customer_code IS NULL;

  -- ─────────────────────────────────────────────────────────────
  -- SHOP-SPECIFIC PRICING (shop_pricing)
  -- ─────────────────────────────────────────────────────────────
  -- Mabini Motors — gets discounts on engine & drivetrain (high-volume)
  INSERT INTO shop_pricing (shop_id, product_id, regular_price, special_price, effective_date, is_active, reason, created_by) VALUES
    (k_mabini, p_piston_125,  420.00, 375.00, CURRENT_DATE - 90, true, 'Volume discount — orders 50+ sets/month', v_user),
    (k_mabini, p_piston_150,  650.00, 580.00, CURRENT_DATE - 90, true, 'Volume discount', v_user),
    (k_mabini, p_ringset_125, 145.00, 120.00, CURRENT_DATE - 90, true, 'Volume discount', v_user),
    (k_mabini, p_gasket_125,  245.00, 210.00, CURRENT_DATE - 90, true, 'Volume discount', v_user),
    (k_mabini, p_chain_428,   185.00, 155.00, CURRENT_DATE - 60, true, 'Loyalty pricing', v_user),
    (k_mabini, p_sprocket_f,  95.00,  80.00,  CURRENT_DATE - 60, true, 'Loyalty pricing', v_user),
    (k_mabini, p_sprocket_r,  185.00, 155.00, CURRENT_DATE - 60, true, 'Loyalty pricing', v_user)
  ON CONFLICT DO NOTHING;

  -- Macapagal Motor Supply — distributor pricing (best rates)
  INSERT INTO shop_pricing (shop_id, product_id, regular_price, special_price, effective_date, is_active, reason, created_by) VALUES
    (k_macapagal, p_piston_125,  420.00, 350.00, CURRENT_DATE - 180, true, 'Distributor rate', v_user),
    (k_macapagal, p_piston_150,  650.00, 540.00, CURRENT_DATE - 180, true, 'Distributor rate', v_user),
    (k_macapagal, p_cdi_unit,    320.00, 265.00, CURRENT_DATE - 180, true, 'Distributor rate', v_user),
    (k_macapagal, p_rectifier,   185.00, 150.00, CURRENT_DATE - 180, true, 'Distributor rate', v_user),
    (k_macapagal, p_brake_pad_f, 145.00, 115.00, CURRENT_DATE - 180, true, 'Distributor rate', v_user),
    (k_macapagal, p_brake_pad_r, 125.00, 98.00,  CURRENT_DATE - 180, true, 'Distributor rate', v_user),
    (k_macapagal, p_spark_ng,    95.00,  72.00,  CURRENT_DATE - 180, true, 'Distributor rate', v_user),
    (k_macapagal, p_spark_irid,  285.00, 230.00, CURRENT_DATE - 180, true, 'Distributor rate', v_user),
    (k_macapagal, p_chain_428,   185.00, 145.00, CURRENT_DATE - 120, true, 'Distributor rate', v_user),
    (k_macapagal, p_air_filter,  65.00,  48.00,  CURRENT_DATE - 120, true, 'Distributor rate', v_user)
  ON CONFLICT DO NOTHING;

  -- Quezon Motor Shop — bulk buyer
  INSERT INTO shop_pricing (shop_id, product_id, regular_price, special_price, effective_date, is_active, reason, created_by) VALUES
    (k_quezon, p_brake_shoe,   85.00,  70.00, CURRENT_DATE - 120, true, 'Monthly bulk deal', v_user),
    (k_quezon, p_brake_pad_f,  145.00, 120.00, CURRENT_DATE - 120, true, 'Monthly bulk deal', v_user),
    (k_quezon, p_air_filter,   65.00,  52.00,  CURRENT_DATE - 90, true,  'Bulk rate 50pcs/order', v_user),
    (k_quezon, p_spark_ng,     95.00,  78.00,  CURRENT_DATE - 90, true,  'Bulk rate', v_user)
  ON CONFLICT DO NOTHING;

  -- Aguinaldo — sports focus, gets suspension/brake discount
  INSERT INTO shop_pricing (shop_id, product_id, regular_price, special_price, effective_date, is_active, reason, created_by) VALUES
    (k_aguinaldo, p_shock_abs,   950.00, 850.00,  CURRENT_DATE - 60, true, 'Sports account deal', v_user),
    (k_aguinaldo, p_brake_disc,  650.00, 580.00,  CURRENT_DATE - 60, true, 'Sports account deal', v_user),
    (k_aguinaldo, p_led_head,    385.00, 330.00,  CURRENT_DATE - 45, true, 'LED promo deal', v_user),
    (k_aguinaldo, p_led_head,    385.00, 310.00,  CURRENT_DATE - 10, false,'Promo expired', v_user)  -- old inactive record for history
  ON CONFLICT DO NOTHING;

  -- ─────────────────────────────────────────────────────────────
  -- SHOP PRICING HISTORY (for demo history tab)
  -- ─────────────────────────────────────────────────────────────
  INSERT INTO shop_pricing_history (shop_id, product_id, previous_price, new_price, effective_date, changed_by, reason, created_at) VALUES
    (k_mabini,    p_piston_125, NULL,   375.00, CURRENT_DATE - 90, v_user, 'Initial special pricing for volume buyer', now() - interval '90 days'),
    (k_macapagal, p_piston_125, NULL,   350.00, CURRENT_DATE - 180, v_user, 'Distributor agreement signed', now() - interval '180 days'),
    (k_macapagal, p_spark_ng,   85.00,  72.00,  CURRENT_DATE - 180, v_user, 'Reduced further for distributor', now() - interval '180 days'),
    (k_aguinaldo, p_led_head,   385.00, 330.00, CURRENT_DATE - 60,  v_user, 'Sports account LED promo', now() - interval '60 days'),
    (k_aguinaldo, p_led_head,   330.00, 310.00, CURRENT_DATE - 10,  v_user, 'Extended promo rate', now() - interval '10 days'),
    (k_quezon,    p_spark_ng,   95.00,  78.00,  CURRENT_DATE - 90,  v_user, 'Bulk pricing approved by owner', now() - interval '90 days')
  ON CONFLICT DO NOTHING;

  -- ─────────────────────────────────────────────────────────────
  -- ORDERS
  -- ─────────────────────────────────────────────────────────────

  -- O1: Bagong Ilaw — CLOSED / PAID — engine rebuild order
  INSERT INTO orders (id, order_number, customer_id, status, payment_method, payment_status,
    subtotal, discount_amount, total_amount, amount_paid, balance_due, due_date, notes, created_by, created_at, updated_at) VALUES
    (o1, 'ORD-2025-001', k_bagong, 'CLOSED', 'CASH', 'PAID',
     3520.00, 0.00, 3520.00, 3520.00, 0.00, NULL,
     'Engine rebuild parts for customer Honda Wave 125. Rush order.', v_user,
     now() - interval '45 days', now() - interval '44 days')
  ON CONFLICT DO NOTHING;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, discount_percent, subtotal) VALUES
    (o1, p_piston_125,  3, 420.00, 0, 1260.00),
    (o1, p_ringset_125, 3, 145.00, 0, 435.00),
    (o1, p_gasket_125,  3, 245.00, 0, 735.00),
    (o1, p_valve_in,    6, 85.00,  0, 510.00),
    (o1, p_valve_ex,    6, 95.00,  0, 570.00)
  ON CONFLICT DO NOTHING;

  -- O2: Santos — DELIVERED / PAID — brake and filter order
  INSERT INTO orders (id, order_number, customer_id, status, payment_method, payment_status,
    subtotal, discount_amount, total_amount, amount_paid, balance_due, due_date, notes, created_by, created_at, updated_at) VALUES
    (o2, 'ORD-2025-002', k_santos, 'DELIVERED', 'GCASH', 'PAID',
     755.00, 0.00, 755.00, 755.00, 0.00, NULL,
     'GCash ref: GCR-78234512. Brake service parts.', v_user,
     now() - interval '30 days', now() - interval '29 days')
  ON CONFLICT DO NOTHING;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, discount_percent, subtotal) VALUES
    (o2, p_brake_pad_f, 2, 145.00, 0, 290.00),
    (o2, p_brake_shoe,  3, 85.00,  0, 255.00),
    (o2, p_air_filter,  2, 65.00,  0, 130.00),
    (o2, p_fuel_filter, 2, 35.00,  0, 70.00)
  ON CONFLICT DO NOTHING;

  -- O3: Mabini — CLOSED / PAID — bulk engine parts (with shop pricing)
  INSERT INTO orders (id, order_number, customer_id, status, payment_method, payment_status,
    subtotal, discount_amount, total_amount, amount_paid, balance_due, due_date, notes, created_by, created_at, updated_at) VALUES
    (o3, 'ORD-2025-003', k_mabini, 'CLOSED', 'CASH', 'PAID',
     22350.00, 2100.00, 20250.00, 20250.00, 0.00, NULL,
     'Monthly bulk order — Mabini. Shop pricing applied on engine & drivetrain.', v_user,
     now() - interval '60 days', now() - interval '58 days')
  ON CONFLICT DO NOTHING;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, discount_percent, subtotal) VALUES
    (o3, p_piston_125,  20, 375.00, 0, 7500.00),
    (o3, p_ringset_125, 20, 120.00, 0, 2400.00),
    (o3, p_gasket_125,  20, 210.00, 0, 4200.00),
    (o3, p_chain_428,   15, 155.00, 0, 2325.00),
    (o3, p_sprocket_f,  15, 80.00,  0, 1200.00),
    (o3, p_sprocket_r,  15, 155.00, 0, 2325.00)
  ON CONFLICT DO NOTHING;

  -- O4: Rizal — DISPATCHED / UNPAID — check payment pending
  INSERT INTO orders (id, order_number, customer_id, status, payment_method, payment_status,
    subtotal, discount_amount, total_amount, amount_paid, balance_due, due_date, notes, created_by, created_at, updated_at) VALUES
    (o4, 'ORD-2025-004', k_rizal, 'DISPATCHED', 'CHECK', 'UNPAID',
     8450.00, 0.00, 8450.00, 0.00, 8450.00, CURRENT_DATE + 15,
     'Check # 001234 dated ' || (CURRENT_DATE + 15)::text || '. BDO account.', v_user,
     now() - interval '5 days', now() - interval '4 days')
  ON CONFLICT DO NOTHING;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, discount_percent, subtotal) VALUES
    (o4, p_cdi_unit,    10, 320.00, 0, 3200.00),
    (o4, p_rectifier,   10, 185.00, 0, 1850.00),
    (o4, p_batt_ytx5,    5, 650.00, 0, 3250.00),
    (o4, p_spark_ng,    15, 95.00,  0, 1425.00)
  ON CONFLICT DO NOTHING;

  -- O5: Luna — PENDING_OWNER_APPROVAL / UNPAID
  INSERT INTO orders (id, order_number, customer_id, status, payment_method, payment_status,
    subtotal, discount_amount, total_amount, amount_paid, balance_due, due_date, notes, created_by, created_at, updated_at) VALUES
    (o5, 'ORD-2025-005', k_luna, 'PENDING_OWNER_APPROVAL', 'CASH', 'UNPAID',
     5240.00, 0.00, 5240.00, 0.00, 5240.00, NULL,
     'Electrical bundle order. Awaiting owner approval.', v_user,
     now() - interval '2 days', now() - interval '2 days')
  ON CONFLICT DO NOTHING;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, discount_percent, subtotal) VALUES
    (o5, p_cdi_unit,   5, 320.00, 0, 1600.00),
    (o5, p_magneto,    2, 1100.00, 0, 2200.00),
    (o5, p_spark_irid, 5, 285.00, 0, 1425.00),
    (o5, p_oil_filter, 5, 45.00,  0, 225.00)
  ON CONFLICT DO NOTHING;

  -- O6: Quezon — CLOSED / PAID — large monthly order
  INSERT INTO orders (id, order_number, customer_id, status, payment_method, payment_status,
    subtotal, discount_amount, total_amount, amount_paid, balance_due, due_date, notes, created_by, created_at, updated_at) VALUES
    (o6, 'ORD-2025-006', k_quezon, 'CLOSED', 'CHECK', 'PAID',
     31500.00, 1800.00, 29700.00, 29700.00, 0.00, NULL,
     'Monthly PDC order. Check cleared on time. Special price on brake and spark.', v_user,
     now() - interval '35 days', now() - interval '32 days')
  ON CONFLICT DO NOTHING;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, discount_percent, subtotal) VALUES
    (o6, p_brake_shoe,  80, 70.00,  0, 5600.00),
    (o6, p_brake_pad_f, 50, 120.00, 0, 6000.00),
    (o6, p_air_filter,  80, 52.00,  0, 4160.00),
    (o6, p_spark_ng,    80, 78.00,  0, 6240.00),
    (o6, p_chain_428,   20, 185.00, 0, 3700.00),
    (o6, p_fuel_filter, 80, 35.00,  0, 2800.00),
    (o6, p_sprocket_f,  15, 95.00,  0, 1425.00)
  ON CONFLICT DO NOTHING;

  -- O7: Macapagal — TERMS / PARTIAL — large distributor order
  INSERT INTO orders (id, order_number, customer_id, status, payment_method, payment_status,
    subtotal, discount_amount, total_amount, amount_paid, balance_due, due_date, notes, created_by, created_at, updated_at) VALUES
    (o7, 'ORD-2025-007', k_macapagal, 'DELIVERED', 'CASH', 'PARTIAL',
     58000.00, 6500.00, 51500.00, 25000.00, 26500.00, CURRENT_DATE + 20,
     'Distributor monthly. Partial payment received. Balance on 60-day term.', v_user,
     now() - interval '10 days', now() - interval '8 days')
  ON CONFLICT DO NOTHING;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, discount_percent, subtotal) VALUES
    (o7, p_piston_125,  50, 350.00, 0, 17500.00),
    (o7, p_piston_150,  20, 540.00, 0, 10800.00),
    (o7, p_cdi_unit,    30, 265.00, 0, 7950.00),
    (o7, p_rectifier,   20, 150.00, 0, 3000.00),
    (o7, p_spark_ng,    50, 72.00,  0, 3600.00),
    (o7, p_brake_pad_f, 30, 115.00, 0, 3450.00),
    (o7, p_air_filter,  50, 48.00,  0, 2400.00),
    (o7, p_chain_428,   15, 145.00, 0, 2175.00),
    (o7, p_fuel_filter, 30, 35.00,  0, 1050.00)
  ON CONFLICT DO NOTHING;

  -- O8: Magsaysay — DRAFT (just created)
  INSERT INTO orders (id, order_number, customer_id, status, payment_method, payment_status,
    subtotal, discount_amount, total_amount, amount_paid, balance_due, notes, created_by, created_at, updated_at) VALUES
    (o8, 'ORD-2025-008', k_magsaysay, 'DRAFT', 'CASH', 'UNPAID',
     1195.00, 0.00, 1195.00, 0.00, 1195.00,
     'Repair job parts — 2 units Wave 125. Customer waiting.', v_user,
     now() - interval '1 hour', now() - interval '1 hour')
  ON CONFLICT DO NOTHING;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, discount_percent, subtotal) VALUES
    (o8, p_gasket_125,  2, 245.00, 0, 490.00),
    (o8, p_ringset_125, 2, 145.00, 0, 290.00),
    (o8, p_brake_shoe,  2, 85.00,  0, 170.00),
    (o8, p_spark_ng,    2, 95.00,  0, 190.00),
    (o8, p_oil_filter,  3, 45.00,  0, 135.00),
    (o8, p_air_filter,  3, 65.00,  0, 195.00)
  ON CONFLICT DO NOTHING;


  -- O9: Boni — OVERDUE (past due_date, PARTIAL)
  INSERT INTO orders (id, order_number, customer_id, status, payment_method, payment_status,
    subtotal, discount_amount, total_amount, amount_paid, balance_due, due_date, notes, created_by, created_at, updated_at) VALUES
    (o9, 'ORD-2025-009', k_boni, 'DELIVERED', 'CASH', 'PARTIAL',
     12500.00, 0.00, 12500.00, 5000.00, 7500.00, CURRENT_DATE - 10,
     'Payment overdue by 10 days. Follow up with Ramon.', v_user,
     now() - interval '70 days', now() - interval '10 days')
  ON CONFLICT DO NOTHING;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, discount_percent, subtotal) VALUES
    (o9, p_shock_abs,   5, 950.00, 0, 4750.00),
    (o9, p_fork_seal,   8, 120.00, 0, 960.00),
    (o9, p_brake_disc,  5, 650.00, 0, 3250.00),
    (o9, p_led_head,    5, 385.00, 0, 1925.00),
    (o9, p_turn_sig,    4, 185.00, 0, 740.00)
  ON CONFLICT DO NOTHING;

  -- O10: Aguinaldo — QUOTATION_GENERATED
  INSERT INTO orders (id, order_number, customer_id, status, payment_method, payment_status,
    subtotal, discount_amount, total_amount, amount_paid, balance_due, notes, created_by, created_at, updated_at) VALUES
    (o10, 'ORD-2025-010', k_aguinaldo, 'QUOTATION_GENERATED', 'CASH', 'UNPAID',
     18450.00, 800.00, 17650.00, 0.00, 17650.00,
     'Sports upgrade package. Quotation sent to customer email.', v_user,
     now() - interval '3 days', now() - interval '3 days')
  ON CONFLICT DO NOTHING;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, discount_percent, subtotal) VALUES
    (o10, p_shock_abs,   4, 850.00, 0, 3400.00),
    (o10, p_brake_disc,  4, 580.00, 0, 2320.00),
    (o10, p_brake_pad_f, 4, 145.00, 0, 580.00),
    (o10, p_led_head,    4, 330.00, 0, 1320.00),
    (o10, p_batt_ytx12,  4, 1450.00, 0, 5800.00),
    (o10, p_chain_520,   4, 680.00, 0, 2720.00),
    (o10, p_turn_sig,    4, 185.00, 0, 740.00)
  ON CONFLICT DO NOTHING;

  -- O11: Abad — CLOSED / PAID
  INSERT INTO orders (id, order_number, customer_id, status, payment_method, payment_status,
    subtotal, discount_amount, total_amount, amount_paid, balance_due, due_date, notes, created_by, created_at, updated_at) VALUES
    (o11, 'ORD-2025-011', k_abad, 'CLOSED', 'GCASH', 'PAID',
     4875.00, 0.00, 4875.00, 4875.00, 0.00, NULL,
     'Shipped via LBC Freight. GCash ref: GCR-99341278.', v_user,
     now() - interval '20 days', now() - interval '18 days')
  ON CONFLICT DO NOTHING;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, discount_percent, subtotal) VALUES
    (o11, p_piston_50,   5, 285.00, 0, 1425.00),
    (o11, p_ringset_50,  5, 95.00,  0, 475.00),
    (o11, p_gasket_50,   5, 155.00, 0, 775.00),
    (o11, p_spark_ng,   10, 95.00,  0, 950.00),
    (o11, p_air_filter,  5, 65.00,  0, 325.00),
    (o11, p_brake_shoe,  5, 85.00,  0, 425.00),
    (o11, p_brake_cable, 5, 55.00,  0, 275.00)
  ON CONFLICT DO NOTHING;

  -- O12-O15: Additional recent orders
  INSERT INTO orders (id, order_number, customer_id, status, payment_method, payment_status,
    subtotal, discount_amount, total_amount, amount_paid, balance_due, notes, created_by, created_at, updated_at) VALUES
    (o12, 'ORD-2025-012', k_bagong,    'DELIVERED', 'CASH',  'PAID',    2450.00, 0, 2450.00, 2450.00, 0,    'Brake system overhaul parts.', v_user, now() - interval '15 days', now() - interval '14 days'),
    (o13, 'ORD-2025-013', k_santos,    'DISPATCHED','GCASH', 'PAID',    1840.00, 0, 1840.00, 1840.00, 0,    'Scooter accessories bundle.', v_user, now() - interval '7 days', now() - interval '6 days'),
    (o14, 'ORD-2025-014', k_mabini,    'DELIVERED', 'CASH',  'PARTIAL', 15000.00, 1200.00, 13800.00, 6900.00, 6900.00, 'Mid-month restock. Partial.', v_user, now() - interval '12 days', now() - interval '11 days'),
    (o15, 'ORD-2025-015', k_macapagal, 'DRAFT',     'CASH',  'UNPAID',  9800.00, 0, 9800.00, 0, 9800.00, 'Next month batch — draft pending confirmation.', v_user, now() - interval '1 day', now() - interval '1 day')
  ON CONFLICT DO NOTHING;

  INSERT INTO order_items (order_id, product_id, quantity, unit_price, discount_percent, subtotal) VALUES
    (o12, p_brake_pad_f, 4, 145.00, 0, 580.00),
    (o12, p_brake_pad_r, 4, 125.00, 0, 500.00),
    (o12, p_brake_disc,  2, 650.00, 0, 1300.00),
    (o12, p_brake_cable, 2, 55.00,  0, 110.00),

    (o13, p_fairng_l,    2, 420.00, 0, 840.00),
    (o13, p_fairng_r,    2, 420.00, 0, 840.00),
    (o13, p_fender_f,    1, 280.00, 0, 280.00),
    (o13, p_turn_sig,    1, 185.00, 0, 185.00),

    (o14, p_piston_125,  20, 375.00, 0, 7500.00),
    (o14, p_gasket_125,  20, 210.00, 0, 4200.00),
    (o14, p_ringset_125, 10, 120.00, 0, 1200.00),

    (o15, p_cdi_unit,    15, 265.00, 0, 3975.00),
    (o15, p_rectifier,   15, 150.00, 0, 2250.00),
    (o15, p_batt_ytx5,    5, 650.00, 0, 3250.00),
    (o15, p_spark_irid,  10, 230.00, 0, 2300.00)
  ON CONFLICT DO NOTHING;

  -- ─────────────────────────────────────────────────────────────
  -- PAYMENTS
  -- ─────────────────────────────────────────────────────────────
  INSERT INTO payments (order_id, amount, payment_method, reference_number, notes, recorded_by, created_at) VALUES
    (o1,  3520.00, 'CASH',  NULL,             'Full payment on delivery.',         v_user, now() - interval '44 days'),
    (o2,  755.00,  'GCASH', 'GCR-78234512',   'GCash — full payment.',             v_user, now() - interval '29 days'),
    (o3,  20250.00,'CASH',  NULL,             'Full cash payment. Bulk order.',    v_user, now() - interval '58 days'),
    (o6,  29700.00,'CHECK', 'CHK-001180-BDO', 'PDC cleared on due date.',          v_user, now() - interval '32 days'),
    (o7,  25000.00,'CASH',  NULL,             'Partial — downpayment 50%.',        v_user, now() - interval '8 days'),
    (o9,  5000.00, 'CASH',  NULL,             'Partial payment. Balance overdue.', v_user, now() - interval '40 days'),
    (o11, 4875.00, 'GCASH', 'GCR-99341278',   'GCash — full amount.',              v_user, now() - interval '18 days'),
    (o12, 2450.00, 'CASH',  NULL,             'Cash on delivery.',                 v_user, now() - interval '14 days'),
    (o13, 1840.00, 'GCASH', 'GCR-55312980',   'GCash confirmed.',                  v_user, now() - interval '6 days'),
    (o14, 6900.00, 'CASH',  NULL,             'Initial 50% payment.',              v_user, now() - interval '11 days')
  ON CONFLICT DO NOTHING;

  -- Stock movements: movement_type, quantity_change, quantity_before, quantity_after, reason (required)
  INSERT INTO stock_movements (product_id, movement_type, quantity_change, quantity_before, quantity_after, reason, created_by, created_at) VALUES
    (p_piston_125,  'IN', 200, 0,   200, 'Initial stock from supplier Topgun Enterprises — PO-2025-001', v_user, now() - interval '6 months'),
    (p_piston_150,  'IN', 150, 0,   150, 'Initial stock from Topgun Enterprises — PO-2025-001',          v_user, now() - interval '6 months'),
    (p_piston_50,   'IN', 120, 0,   120, 'Initial stock from Topgun Enterprises — PO-2025-001',          v_user, now() - interval '6 months'),
    (p_ringset_125, 'IN', 220, 0,   220, 'Initial stock from ACE Motor Supply — PO-2025-002',            v_user, now() - interval '5 months'),
    (p_gasket_125,  'IN', 130, 0,   130, 'Initial stock from ACE Motor Supply — PO-2025-002',            v_user, now() - interval '5 months'),
    (p_cdi_unit,    'IN', 90,  0,   90,  'Initial stock — Regulus Electronics — PO-2025-003',            v_user, now() - interval '4 months'),
    (p_spark_ng,    'IN', 500, 0,   500, 'Bulk spark plugs from NGK distributor — PO-2025-003',          v_user, now() - interval '4 months'),
    (p_brake_pad_f, 'IN', 250, 0,   250, 'Initial brake system stock — PO-2025-004',                     v_user, now() - interval '4 months'),
    (p_chain_428,   'IN', 200, 0,   200, 'Initial chain stock from JTC Philippines — PO-2025-004',       v_user, now() - interval '3 months'),
    (p_air_filter,  'IN', 400, 0,   400, 'Bulk filters from Uni Filter PH — PO-2025-005',               v_user, now() - interval '3 months')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE '✅ Seed data inserted successfully!';
  RAISE NOTICE '   Categories: 8';
  RAISE NOTICE '   Products: 46';
  RAISE NOTICE '   Shops / Customers: 12 (11 active, 1 inactive)';
  RAISE NOTICE '   Shop-specific prices: 21 records';
  RAISE NOTICE '   Orders: 15';
  RAISE NOTICE '   Payments: 10';
  RAISE NOTICE '   Stock movements: 10';

END $$;
