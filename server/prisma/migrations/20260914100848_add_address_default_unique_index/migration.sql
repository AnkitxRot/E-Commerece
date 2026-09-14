-- Enforce "at most one default address per user" at the database level.
-- A partial unique index has no equivalent in Prisma's schema DSL, so this
-- exists only here and is documented on the Address model in schema.prisma.
CREATE UNIQUE INDEX "Address_userId_default_key" ON "Address"("userId") WHERE "isDefault" = true;
