ALTER TABLE "discount_codes"
ADD CONSTRAINT "discount_codes_percent_amount_range"
CHECK (
  "discount_codes"."type" <> 'percent'
  or (
    "discount_codes"."amount" >= 0
    and "discount_codes"."amount" <= 100
  )
);
