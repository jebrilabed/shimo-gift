-- PostgreSQL checks and a partial index enforce row-level inventory and money rules
-- that Prisma's schema language cannot currently express.
ALTER TABLE "product_skus"
  ADD CONSTRAINT "product_skus_stock_nonnegative_check" CHECK ("stockQuantity" >= 0),
  ADD CONSTRAINT "product_skus_price_nonnegative_check" CHECK ("price" >= 0),
  ADD CONSTRAINT "product_skus_compare_at_nonnegative_check" CHECK ("compareAtPrice" IS NULL OR "compareAtPrice" >= 0);

ALTER TABLE "cart_items"
  ADD CONSTRAINT "cart_items_quantity_positive_check" CHECK ("quantity" > 0);

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_subtotal_nonnegative_check" CHECK ("subtotal" >= 0),
  ADD CONSTRAINT "orders_shipping_nonnegative_check" CHECK ("shippingCost" >= 0),
  ADD CONSTRAINT "orders_discount_nonnegative_check" CHECK ("discountTotal" >= 0),
  ADD CONSTRAINT "orders_total_nonnegative_check" CHECK ("total" >= 0);

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_unit_price_nonnegative_check" CHECK ("unitPrice" >= 0),
  ADD CONSTRAINT "order_items_quantity_positive_check" CHECK ("quantity" > 0),
  ADD CONSTRAINT "order_items_subtotal_nonnegative_check" CHECK ("subtotal" >= 0);

ALTER TABLE "notification_outbox"
  ADD CONSTRAINT "notification_outbox_retry_count_nonnegative_check" CHECK ("retryCount" >= 0);

ALTER TABLE "categories"
  ADD CONSTRAINT "categories_parent_not_self_check" CHECK ("parentId" IS NULL OR "parentId" <> "id");

-- A simple product must have exactly one default SKU at transaction commit. A
-- deferred constraint trigger allows the product and its SKU to be created together.
CREATE FUNCTION "enforce_simple_product_default_sku"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_ids text[];
  target_id text;
  product_kind "ProductKind";
  default_count integer;
BEGIN
  IF TG_TABLE_NAME = 'products' THEN
    target_ids := ARRAY[NEW."id"];
  ELSIF TG_OP = 'INSERT' THEN
    target_ids := ARRAY[NEW."productId"];
  ELSIF TG_OP = 'DELETE' THEN
    target_ids := ARRAY[OLD."productId"];
  ELSE
    target_ids := ARRAY[OLD."productId", NEW."productId"];
  END IF;

  FOREACH target_id IN ARRAY target_ids LOOP
    IF target_id IS NULL THEN
      CONTINUE;
    END IF;

    SELECT "kind" INTO product_kind FROM "products" WHERE "id" = target_id;
    IF FOUND AND product_kind = 'SIMPLE'::"ProductKind" THEN
      SELECT count(*) INTO default_count
      FROM "product_skus"
      WHERE "productId" = target_id AND "isDefault" = true;

      IF default_count <> 1 THEN
        RAISE EXCEPTION 'Simple product % must have exactly one default SKU', target_id
          USING ERRCODE = '23514';
      END IF;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "products_require_simple_default_sku"
AFTER INSERT OR UPDATE ON "products"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "enforce_simple_product_default_sku"();

CREATE CONSTRAINT TRIGGER "product_skus_preserve_simple_default_sku"
AFTER INSERT OR UPDATE OR DELETE ON "product_skus"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "enforce_simple_product_default_sku"();
