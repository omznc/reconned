-- Initial migration from Prisma schema
-- Generated on 2025-12-08T14:11:48.681Z

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE Role AS ENUM ('Role', 'USER', 'MANAGER', 'CLUB_OWNER');

CREATE TYPE InviteStatus AS ENUM ('InviteStatus', 'PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'REVOKED', 'REQUESTED');

CREATE TYPE ReviewType AS ENUM ('ReviewType', 'USER', 'CLUB', 'EVENT');



CREATE TABLE user (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE,
  name VARCHAR(255),
  emailverified BOOLEAN,
  normalizedemail VARCHAR(255) UNIQUE,
  image VARCHAR(255),
  headerimage VARCHAR(255),
  slug VARCHAR(255) UNIQUE,
  bio VARCHAR(255),
  location VARCHAR(255),
  website VARCHAR(255),
  phone VARCHAR(255),
  callsign VARCHAR(255),
  gear JSONB[],
  font VARCHAR(255),
  theme VARCHAR(255),
  style VARCHAR(255),
  isprivate BOOLEAN DEFAULT false,
  isprivateemail BOOLEAN DEFAULT true,
  isprivatephone BOOLEAN DEFAULT true,
  isprivatestats BOOLEAN DEFAULT false,
  clubmembership TEXT,
  clubinvitesreceived TEXT,
  eventregistration TEXT,
  role VARCHAR(255),
  banned BOOLEAN,
  banreason VARCHAR(255),
  banexpires TIMESTAMPTZ,
  twofactorenabled BOOLEAN,
  sessions TEXT,
  accounts TEXT,
  passkeys TEXT,
  twofactors TEXT,
  achievements TEXT,
  createdat TIMESTAMPTZ DEFAULT NOW(),
  updatedat TIMESTAMPTZ,
  clubauditlog TEXT,
  -- Index: user_id_slug_idx on (id, slug),
  -- Index: user_email_idx on (email)
);

-- Foreign key constraints for user
-- TODO: Add proper foreign key constraints based on @relation directives

CREATE TABLE club (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255),
  location VARCHAR(255),
  latitude DECIMAL(10,2),
  longitude DECIMAL(10,2),
  description VARCHAR(255),
  datefounded TIMESTAMPTZ,
  slug VARCHAR(255) UNIQUE,
  isallied BOOLEAN DEFAULT false,
  isprivate BOOLEAN DEFAULT false,
  isprivatestats BOOLEAN DEFAULT false,
  logo VARCHAR(255),
  headerimage VARCHAR(255),
  contactphone VARCHAR(255),
  contactemail VARCHAR(255),
  verified BOOLEAN DEFAULT false,
  website VARCHAR(255),
  instagramusername VARCHAR(255),
  instagramprofilepictureurl VARCHAR(255),
  instagramaccesstoken VARCHAR(255),
  instagramtokenexpiry TIMESTAMPTZ,
  instagramrefreshtoken VARCHAR(255),
  instagramconnected BOOLEAN DEFAULT false,
  instagrambusinessid VARCHAR(255),
  facebookpageid VARCHAR(255),
  instagramtokentype VARCHAR(255),
  events TEXT,
  rules TEXT,
  members TEXT,
  invitessent TEXT,
  reviews TEXT,
  purchases TEXT,
  posts TEXT,
  countryid INTEGER,
  banned BOOLEAN,
  banreason VARCHAR(255),
  banexpires TIMESTAMPTZ,
  createdat TIMESTAMPTZ DEFAULT NOW(),
  updatedat TIMESTAMPTZ,
  clubauditlog TEXT,
  -- Index: club_id_slug_idx on (id, slug)
);

-- Foreign key constraints for club
-- TODO: Add proper foreign key constraints based on @relation directives

CREATE TABLE clubpurchase (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255),
  description VARCHAR(255),
  clubid UUID,
  receipturls TEXT[],
  amount DECIMAL(10,2),
  createdat TIMESTAMPTZ DEFAULT NOW(),
  updatedat TIMESTAMPTZ DEFAULT NOW()
);

-- Foreign key constraints for clubpurchase
-- TODO: Add proper foreign key constraints based on @relation directives

CREATE TABLE clubrule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255),
  description VARCHAR(255),
  content VARCHAR(255),
  clubid UUID,
  eventid VARCHAR(255),
  createdat TIMESTAMPTZ DEFAULT NOW(),
  updatedat TIMESTAMPTZ DEFAULT NOW()
);

-- Foreign key constraints for clubrule
-- TODO: Add proper foreign key constraints based on @relation directives

CREATE TABLE clubmembership (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userid UUID,
  clubid UUID,
  role TEXT,
  startdate TIMESTAMPTZ,
  enddate TIMESTAMPTZ,
  createdat TIMESTAMPTZ DEFAULT NOW(),
  updatedat TIMESTAMPTZ DEFAULT NOW(),
  -- Unique constraint: clubmembership_userId_clubId_key on (userId, clubId)
);

-- Foreign key constraints for clubmembership
-- TODO: Add proper foreign key constraints based on @relation directives

CREATE TABLE clubinvite (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255),
  clubid UUID,
  userid VARCHAR(255),
  status TEXT,
  invitecode VARCHAR(255) UNIQUE,
  expiresat TIMESTAMPTZ,
  createdat TIMESTAMPTZ DEFAULT NOW(),
  updatedat TIMESTAMPTZ DEFAULT NOW(),
  -- Index: clubinvite_email_idx on (email),
  -- Index: clubinvite_status_idx on (status),
  -- Index: clubinvite_inviteCode_idx on (inviteCode),
  -- Index: clubinvite_clubId_idx on (clubId),
  -- Index: clubinvite_userId_idx on (userId)
);

-- Foreign key constraints for clubinvite
-- TODO: Add proper foreign key constraints based on @relation directives

CREATE TABLE instagrampageselection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clubid UUID,
  accesstoken VARCHAR(255),
  pages VARCHAR(255),
  expiresat TIMESTAMPTZ,
  createdat TIMESTAMPTZ DEFAULT NOW(),
  -- Index: instagrampageselection_clubId_idx on (clubId)
);

-- Foreign key constraints for instagrampageselection
-- TODO: Add proper foreign key constraints based on @relation directives

CREATE TABLE event (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255),
  description VARCHAR(255),
  clubid UUID,
  image VARCHAR(255),
  slug VARCHAR(255) UNIQUE,
  datestart TIMESTAMPTZ,
  dateend TIMESTAMPTZ,
  dateregistrationsclose TIMESTAMPTZ,
  dateregistrationsopen TIMESTAMPTZ,
  isprivate BOOLEAN DEFAULT false,
  allowfreelancers BOOLEAN DEFAULT false,
  location VARCHAR(255),
  googlemapslink VARCHAR(255),
  costperperson DECIMAL(10,2) DEFAULT 0,
  hasbreakfast BOOLEAN DEFAULT false,
  haslunch BOOLEAN DEFAULT false,
  hasdinner BOOLEAN DEFAULT false,
  hassnacks BOOLEAN DEFAULT false,
  hasdrinks BOOLEAN DEFAULT false,
  hasprizes BOOLEAN DEFAULT false,
  rules TEXT,
  gearrequirements JSONB[],
  mapdata JSONB,
  eventregistration TEXT,
  eventinvite TEXT,
  reviews TEXT,
  createdat TIMESTAMPTZ DEFAULT NOW(),
  updatedat TIMESTAMPTZ,
  -- Index: event_id_slug_idx on (id, slug)
);

-- Foreign key constraints for event
-- TODO: Add proper foreign key constraints based on @relation directives

CREATE TABLE eventregistration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eventid UUID,
  createdbyid UUID,
  invitedusers TEXT,
  invitedusersnotonapp TEXT,
  type VARCHAR(255),
  paymentmethod VARCHAR(255),
  attended BOOLEAN DEFAULT false,
  createdat TIMESTAMPTZ DEFAULT NOW(),
  updatedat TIMESTAMPTZ DEFAULT NOW()
);

-- Foreign key constraints for eventregistration
-- TODO: Add proper foreign key constraints based on @relation directives

CREATE TABLE eventinvite (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eventid UUID,
  name VARCHAR(255),
  email VARCHAR(255),
  token VARCHAR(255) UNIQUE,
  expiresat TIMESTAMPTZ,
  eventregistrationid VARCHAR(255),
  createdat TIMESTAMPTZ DEFAULT NOW(),
  updatedat TIMESTAMPTZ DEFAULT NOW()
);

-- Foreign key constraints for eventinvite
-- TODO: Add proper foreign key constraints based on @relation directives

CREATE TABLE session (
  id UUID PRIMARY KEY,
  expiresat TIMESTAMPTZ,
  ipaddress VARCHAR(255),
  useragent VARCHAR(255),
  userid UUID,
  token VARCHAR(255),
  createdat TIMESTAMPTZ,
  updatedat TIMESTAMPTZ,
  impersonatedby VARCHAR(255),
  -- Unique constraint: session_token_key on (token),
  -- Index: session_userId_idx on (userId)
);

-- Foreign key constraints for session
-- TODO: Add proper foreign key constraints based on @relation directives

CREATE TABLE account (
  id UUID PRIMARY KEY,
  accountid UUID,
  providerid UUID,
  userid UUID,
  accesstoken VARCHAR(255),
  refreshtoken VARCHAR(255),
  idtoken VARCHAR(255),
  expiresat TIMESTAMPTZ,
  password VARCHAR(255),
  accesstokenexpiresat TIMESTAMPTZ,
  refreshtokenexpiresat TIMESTAMPTZ,
  scope VARCHAR(255),
  createdat TIMESTAMPTZ,
  updatedat TIMESTAMPTZ,
  -- Index: account_userId_idx on (userId)
);

-- Foreign key constraints for account
-- TODO: Add proper foreign key constraints based on @relation directives

CREATE TABLE verification (
  id UUID PRIMARY KEY,
  identifier UUID,
  value VARCHAR(255),
  expiresat TIMESTAMPTZ,
  createdat TIMESTAMPTZ,
  updatedat TIMESTAMPTZ,
  -- Index: verification_identifier_idx on (identifier)
);

-- Foreign key constraints for verification
-- TODO: Add proper foreign key constraints based on @relation directives

CREATE TABLE passkey (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  publickey VARCHAR(255),
  userid UUID,
  webauthnuserid UUID,
  counter INTEGER,
  devicetype VARCHAR(255),
  backedup BOOLEAN,
  transports VARCHAR(255),
  createdat TIMESTAMPTZ,
  credentialid UUID,
  -- Index: passkey_userId_idx on (userId)
);

-- Foreign key constraints for passkey
-- TODO: Add proper foreign key constraints based on @relation directives

CREATE TABLE twofactor (
  id UUID PRIMARY KEY,
  secret VARCHAR(255),
  backupcodes VARCHAR(255),
  userid UUID UNIQUE,
  -- Index: twofactor_secret_idx on (secret),
  -- Index: twofactor_userId_idx on (userId)
);

-- Foreign key constraints for twofactor
-- TODO: Add proper foreign key constraints based on @relation directives

CREATE TABLE review (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT,
  rating INTEGER,
  content VARCHAR(255),
  authorid UUID,
  userid VARCHAR(255),
  clubid VARCHAR(255),
  eventid VARCHAR(255),
  createdat TIMESTAMPTZ DEFAULT NOW(),
  updatedat TIMESTAMPTZ,
  -- Unique constraint: review_authorId_userId_key on (authorId, userId),
  -- Unique constraint: review_authorId_clubId_key on (authorId, clubId),
  -- Unique constraint: review_authorId_eventId_key on (authorId, eventId)
);

-- Foreign key constraints for review
-- TODO: Add proper foreign key constraints based on @relation directives

CREATE TABLE post (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255),
  content VARCHAR(255),
  images TEXT[],
  ispublic BOOLEAN DEFAULT false,
  clubid UUID,
  createdat TIMESTAMPTZ DEFAULT NOW(),
  updatedat TIMESTAMPTZ,
  -- Index: post_clubId_idx on (clubId)
);

-- Foreign key constraints for post
-- TODO: Add proper foreign key constraints based on @relation directives

CREATE TABLE achievement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(255) UNIQUE,
  description VARCHAR(255),
  achievedby TEXT,
  createdat TIMESTAMPTZ DEFAULT NOW(),
  updatedat TIMESTAMPTZ
);

-- Foreign key constraints for achievement
-- TODO: Add proper foreign key constraints based on @relation directives

CREATE TABLE clubauditlog (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  createdat TIMESTAMPTZ DEFAULT NOW(),
  userid VARCHAR(255),
  clubid UUID,
  actiontype VARCHAR(255),
  actiondata JSONB,
  ipaddress VARCHAR(255),
  useragent VARCHAR(255),
  -- Index: clubauditlog_clubId_idx on (clubId),
  -- Index: clubauditlog_userId_idx on (userId),
  -- Index: clubauditlog_actionType_idx on (actionType),
  -- Index: clubauditlog_createdAt_idx on (createdAt)
);

-- Foreign key constraints for clubauditlog
-- TODO: Add proper foreign key constraints based on @relation directives

CREATE TABLE country (
  id INTEGER PRIMARY KEY,
  name VARCHAR(255),
  iso3 VARCHAR(255) UNIQUE,
  iso2 VARCHAR(255) UNIQUE,
  numericcode VARCHAR(255),
  phonecode VARCHAR(255),
  capital VARCHAR(255),
  currency VARCHAR(255),
  currencyname VARCHAR(255),
  currencysymbol VARCHAR(255),
  tld VARCHAR(255),
  native VARCHAR(255),
  region VARCHAR(255),
  subregion VARCHAR(255),
  latitude TEXT,
  longitude TEXT,
  emoji VARCHAR(255),
  emojiu VARCHAR(255),
  timezones JSONB,
  translations JSONB,
  wikidataid VARCHAR(255),
  enabled BOOLEAN DEFAULT true,
  clubs TEXT,
  createdat TIMESTAMPTZ DEFAULT NOW(),
  updatedat TIMESTAMPTZ
);

-- Foreign key constraints for country
-- TODO: Add proper foreign key constraints based on @relation directives


